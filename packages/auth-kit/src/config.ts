import { createHash } from "node:crypto";

import { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { after, userAgent } from "next/server";

import type { AuthDbAdapter, RoleName } from "./adapter";
import type { AuditEvent } from "./audit-event";
import { LOGIN_PATH, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./constants";
import { verifyCredentials, type CredentialDeps } from "./credentials";
import type { createMfa } from "./mfa/mfa";
import { verifyPassword } from "./password";
import { passwordFingerprint } from "./session/state";
import type { createSessionStore } from "./session/store";
import { clientIp, UNKNOWN_IP } from "./security/ip";

// Auth.js with a credentials provider and a 24 hour JWT. The JWT only points at
// a Postgres session row (`sid`); the row decides whether it still counts
// (lib/auth/dal.ts). docs/plan/admin-cms-adr.md, sections 6.3 and 6.4.

/** Codes travel from `authorize` to the server action that called `signIn`. */
export class InvalidLogin extends CredentialsSignin {
  code = "invalid";
}
export class LimitedLogin extends CredentialsSignin {
  code = "limited";
}
export class MfaLogin extends CredentialsSignin {
  code = "mfa_required";
}

function describeDevice(ua: string | null): { browser: string | null; os: string | null } {
  if (!ua) return { browser: null, os: null };
  const parsed = userAgent({ headers: new Headers({ "user-agent": ua }) });
  return { browser: parsed.browser.name ?? null, os: parsed.os.name ?? null };
}

const failureKey = (email: string) => `sahan:login:fail:${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;

export interface AuthConfigDeps {
  adapter: AuthDbAdapter;
  authSecret: string;
  authTrustHost: boolean;
  authDebug: boolean;
  production: boolean;
  sessionStore: ReturnType<typeof createSessionStore>;
  mfa: ReturnType<typeof createMfa>;
  bootstrap: () => Promise<void>;
  loginFailureWindowSeconds: number;
  limit: (bucket: string, key: string) => Promise<{ ok: boolean }>;
  failures: {
    reserve: (key: string, windowSeconds: number) => Promise<number>;
    clear: (key: string) => Promise<void>;
  };
  audit: (event: AuditEvent) => Promise<void>;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  sendKnownDeviceEmail: (input: {
    name: string | null;
    email: string;
    userId: string;
    ip: string | null;
    browser: string | null;
    os: string | null;
  }) => Promise<void>;
}

export function createAuthConfig(deps: AuthConfigDeps): NextAuthConfig {
  const { adapter, authSecret, sessionStore, mfa, bootstrap, limit, failures, audit, warn, sendKnownDeviceEmail } = deps;

  const baseCredentialDeps: CredentialDeps = {
    ensureOwner: bootstrap,
    findUser: async (email) => {
      const user = await adapter.findUserForAuth(email);
      return user ? { ...user, role: user.role as RoleName } : null;
    },
    compare: verifyPassword,
    allowIp: async (ip) => {
      if (ip === UNKNOWN_IP) {
        warn("sign-in: client IP is unknown (set TRUSTED_PROXY_HOPS); IP rate limit skipped");
        return true;
      }
      return (await limit("login:ip", ip)).ok;
    },
    failures: {
      reserve: (email) => failures.reserve(failureKey(email), deps.loginFailureWindowSeconds),
      clear: (email) => failures.clear(failureKey(email)),
    },
    audit: (event) => audit(event),
    warn,
  };

  interface SigningIn {
    id: string;
    email: string;
    name: string | null;
    role: RoleName;
    passwordHash: string;
  }

  /** Creates the session row, records the sign-in and returns what goes into the JWT. */
  async function finishSignIn(user: SigningIn, context: { ip: string | null; ua: string | null; mfa: boolean }) {
    const known = await sessionStore.isKnownDevice(user.id, context.ip, context.ua);
    const session = await sessionStore.createSession({
      userId: user.id,
      ip: context.ip,
      userAgent: context.ua,
      mfaVerified: context.mfa,
    });
    await adapter.updateLastLoginAt(user.id, new Date());
    await audit({
      action: "auth.login.success",
      actor: { id: user.id, email: user.email },
      entityType: "UserSession",
      entityId: session.id,
      meta: { mfa: context.mfa },
      ip: context.ip,
      userAgent: context.ua,
    });

    // Tell the owner of the account about a sign-in from a device they have not used before.
    if (!known) {
      const parsed = describeDevice(context.ua);
      after(() =>
        sendKnownDeviceEmail({
          name: user.name,
          email: user.email,
          userId: user.id,
          ip: context.ip,
          browser: parsed.browser,
          os: parsed.os,
        }).catch(() => undefined)
      );
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sid: session.id,
      pwf: passwordFingerprint(user.passwordHash, authSecret),
      mfa: context.mfa,
    };
  }

  async function authorize(credentials: Partial<Record<string, unknown>>, request: Request) {
    const ip = clientIp(request.headers);
    const knownIp = ip === UNKNOWN_IP ? null : ip;
    const ua = request.headers.get("user-agent");

    // Second step of an MFA sign-in: no password here, only a challenge whose code
    // was verified in the last 60 seconds. It can be used exactly once.
    if (typeof credentials.challengeId === "string" && credentials.email === undefined) {
      // Same UNKNOWN_IP fail-open as allowIp above.
      if (ip !== UNKNOWN_IP && !(await limit("login:ip", ip)).ok) throw new LimitedLogin();
      const owner = await mfa.challengeOwner(credentials.challengeId, "SIGN_IN");
      if (!owner || owner.user.disabledAt) throw new InvalidLogin();
      if (!(await mfa.consumeChallenge({ challengeId: credentials.challengeId, userId: owner.userId, purpose: "SIGN_IN" }))) {
        throw new InvalidLogin();
      }
      const user = await adapter.findUserById(owner.userId);
      if (!user) throw new InvalidLogin();
      return finishSignIn({ ...user, role: user.role as RoleName }, { ip: knownIp, ua, mfa: true });
    }

    const result = await verifyCredentials({ email: credentials.email, password: credentials.password, ip, userAgent: ua }, baseCredentialDeps);
    if (!result.ok) {
      if (result.reason === "limited") throw new LimitedLogin();
      throw new InvalidLogin();
    }
    // A right password is not enough for an account with a second factor: the
    // sign-in action sends the code, and the session only starts after it.
    if (result.user.mfaEnabled) throw new MfaLogin();

    return finishSignIn(result.user, { ip: knownIp, ua, mfa: false });
  }

  return {
    secret: authSecret,
    trustHost: deps.authTrustHost || !deps.production,
    // Never in production, and the debug logger stays silent either way: Auth.js
    // logs the request body (the typed password included) when authorize fails
    // with something other than a sign-in error.
    debug: !deps.production && deps.authDebug,
    logger: {
      debug() {},
      // A wrong password is an audited, expected outcome; skip Auth.js stack traces for it.
      error(error) {
        if (error.name === "CredentialsSignin" || (error as { type?: string }).type === "CredentialsSignin") return;
        console.error(`[auth] ${error.name}: ${error.message}`);
      },
    },
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
    jwt: { maxAge: SESSION_MAX_AGE_SECONDS },
    pages: { signIn: LOGIN_PATH, error: LOGIN_PATH },
    cookies: {
      sessionToken: {
        name: SESSION_COOKIE,
        options: { httpOnly: true, sameSite: "lax", path: "/", secure: deps.production },
      },
    },
    providers: [
      Credentials({
        credentials: { email: {}, password: {}, challengeId: {} },
        authorize: (credentials, request) => authorize(credentials, request),
      }),
    ],
    callbacks: {
      jwt({ token, user, trigger, session }) {
        if (user) {
          token.sub = user.id;
          token.sid = user.sid;
          token.role = user.role;
          token.pwf = user.pwf;
          token.mfa = user.mfa ?? false;
        }
        // Only the server can trigger this (unstable_update, used after a password
        // change, so the session that changed it stays valid); the Auth.js
        // endpoint that a browser could call answers 404.
        if (trigger === "update" && typeof (session as { pwf?: unknown } | undefined)?.pwf === "string") {
          token.pwf = (session as { pwf: string }).pwf;
        }
        return token;
      },
      session({ session, token }) {
        // `token` here is `@auth/core/jwt`'s `JWT`, whose ambient augmentation
        // (declared in next-auth.d.ts) does not get picked up through the
        // `next-auth`/`@auth/core` re-export chain in every project that
        // consumes this package, so its custom claims resolve to `unknown`.
        // The runtime shape is guaranteed by the `jwt` callback above.
        session.user.id = token.sub ?? "";
        session.sid = (token.sid as string | undefined) ?? "";
        session.role = (token.role as RoleName | undefined) ?? "EDITOR";
        session.pwf = (token.pwf as string | undefined) ?? "";
        session.mfa = (token.mfa as boolean | undefined) ?? false;
        return session;
      },
    },
  };
}
