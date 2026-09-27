import { createHash } from "node:crypto";

import { userAgent } from "next/server";

import type { AuthDbAdapter, RoleName } from "./adapter";
import type { AuditEvent } from "./audit-event";
import { verifyCredentials, type CredentialDeps } from "./credentials";
import type { createMfa } from "./mfa/mfa";
import { verifyPassword } from "./password";
import { clientIp, UNKNOWN_IP } from "./security/ip";
import { passwordFingerprint } from "./session/state";
import type { createSessionStore } from "./session/store";

// The credentials `authorize` decision, pulled out of config.ts so it can be
// unit tested without importing `next-auth` (which, in this monorepo's test
// harness — `node --conditions=react-server` — transitively pulls in
// `next/navigation`'s router context and fails to load outside an actual
// Next.js runtime; `next/server`, used here for `after`/`userAgent`, does not
// have that problem). config.ts wraps `createAuthorize`'s generic result in
// the next-auth-specific `CredentialsSignin` subclasses it throws.

export interface AuthorizeDeps {
  adapter: AuthDbAdapter;
  authSecret: string;
  /** Namespaces every KV key this module writes (failure counters). For example `"myapp:"`. */
  keyPrefix: string;
  sessionStore: ReturnType<typeof createSessionStore>;
  mfa: ReturnType<typeof createMfa>;
  bootstrap: () => Promise<void>;
  loginFailureWindowSeconds: number;
  /** Attempts allowed per window before the account is locked (the app's own "login:acct"-shaped bucket). */
  loginFailureMaxAttempts: number;
  limit: (bucket: string, key: string) => Promise<{ ok: boolean }>;
  failures: {
    reserve: (key: string, windowSeconds: number) => Promise<number>;
    clear: (key: string) => Promise<void>;
  };
  audit: (event: AuditEvent) => Promise<void>;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  /**
   * `next/server`'s `after`, injected rather than imported directly: it
   * throws "called outside a request scope" when invoked outside a real
   * Next.js request (a route handler, a Server Action, ...), which a unit
   * test is not. The app wires the real `after`; a test wires a stub that
   * just runs the callback (synchronously or not).
   */
  after: (fn: () => void) => void;
  sendKnownDeviceEmail: (input: {
    name: string | null;
    email: string;
    userId: string;
    ip: string | null;
    browser: string | null;
    os: string | null;
  }) => Promise<void>;
}

export interface SignedInSession {
  id: string;
  email: string;
  name: string | null;
  role: RoleName;
  sid: string;
  pwf: string;
  mfa: boolean;
}

export type AuthorizeResult =
  | { kind: "signed_in"; session: SignedInSession }
  | { kind: "invalid" }
  | { kind: "limited" }
  | { kind: "mfa_required" };

function describeDevice(ua: string | null): { browser: string | null; os: string | null } {
  if (!ua) return { browser: null, os: null };
  const parsed = userAgent({ headers: new Headers({ "user-agent": ua }) });
  return { browser: parsed.browser.name ?? null, os: parsed.os.name ?? null };
}

const failureKey = (keyPrefix: string, email: string) =>
  `${keyPrefix}login:fail:${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;

export function createAuthorize(deps: AuthorizeDeps) {
  const { adapter, authSecret, sessionStore, mfa, bootstrap, limit, failures, audit, warn, after, sendKnownDeviceEmail } = deps;

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
      reserve: (email) => failures.reserve(failureKey(deps.keyPrefix, email), deps.loginFailureWindowSeconds),
      clear: (email) => failures.clear(failureKey(deps.keyPrefix, email)),
      max: deps.loginFailureMaxAttempts,
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
  async function finishSignIn(user: SigningIn, context: { ip: string | null; ua: string | null; mfa: boolean }): Promise<SignedInSession> {
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

  /**
   * Decides what an `authorize` call should do, without throwing any
   * next-auth-specific error. `request` only needs `headers`, so a test can
   * pass a plain `{ headers: new Headers(...) }` instead of a real `Request`.
   */
  return async function authorize(credentials: Partial<Record<string, unknown>>, request: { headers: Headers }): Promise<AuthorizeResult> {
    const ip = clientIp(request.headers);
    const knownIp = ip === UNKNOWN_IP ? null : ip;
    const ua = request.headers.get("user-agent");

    // Second step of an MFA sign-in: no password here, only a challenge whose code
    // was verified in the last 60 seconds. It can be used exactly once.
    if (typeof credentials.challengeId === "string" && credentials.email === undefined) {
      // Same UNKNOWN_IP fail-open as allowIp above.
      if (ip !== UNKNOWN_IP && !(await limit("login:ip", ip)).ok) return { kind: "limited" };
      const owner = await mfa.challengeOwner(credentials.challengeId, "SIGN_IN");
      if (!owner || owner.user.disabledAt) return { kind: "invalid" };
      if (!(await mfa.consumeChallenge({ challengeId: credentials.challengeId, userId: owner.userId, purpose: "SIGN_IN" }))) {
        return { kind: "invalid" };
      }
      const user = await adapter.findUserById(owner.userId);
      if (!user) return { kind: "invalid" };
      return { kind: "signed_in", session: await finishSignIn({ ...user, role: user.role as RoleName }, { ip: knownIp, ua, mfa: true }) };
    }

    const result = await verifyCredentials({ email: credentials.email, password: credentials.password, ip, userAgent: ua }, baseCredentialDeps);
    if (!result.ok) {
      return result.reason === "limited" ? { kind: "limited" } : { kind: "invalid" };
    }
    // A right password is not enough for an account with a second factor: the
    // sign-in action sends the code, and the session only starts after it.
    if (result.user.mfaEnabled) return { kind: "mfa_required" };

    return { kind: "signed_in", session: await finishSignIn(result.user, { ip: knownIp, ua, mfa: false }) };
  };
}
