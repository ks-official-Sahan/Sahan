import "server-only";

import { createHash } from "node:crypto";

import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { after, userAgent } from "next/server";

import { auditSafe } from "@/lib/admin/audit";
import { limit, LIMITS } from "@/lib/cache/ratelimit";
import { kv } from "@/lib/cache/redis";
import { db } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email";
import { newLogin } from "@/lib/email/templates";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { clientIp, UNKNOWN_IP } from "@/lib/security/ip";

import { ensureBootstrapOwner } from "./bootstrap";
import { LOGIN_PATH, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./constants";
import { verifyCredentials, type CredentialDeps } from "./credentials";
import { verifyPassword } from "./password";
import type { RoleName } from "./permissions";
import { challengeOwner, consumeChallenge } from "./mfa";
import { passwordFingerprint } from "./session-state";
import { createSession, isKnownDevice } from "./session-store";

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

const failureKey = (email: string) =>
  `sahan:login:fail:${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;

function credentialDeps(): CredentialDeps {
  const windowSeconds = LIMITS["login:acct"].windowSeconds;
  return {
    ensureOwner: ensureBootstrapOwner,
    findUser: async (email) => {
      const user = await db.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          passwordHash: true,
          disabledAt: true,
          mfaEnabled: true,
        },
      });
      return user ? { ...user, role: user.role as RoleName } : null;
    },
    compare: verifyPassword,
    allowIp: async (ip) => (await limit("login:ip", ip)).ok,
    failures: {
      // The TTL is set when the counter is created, so a steady attacker cannot
      // keep a window open, and the increment and the TTL are one transaction.
      reserve: (email) => kv.incr(failureKey(email), windowSeconds),
      clear: async (email) => void (await kv.del(failureKey(email))),
    },
    audit: (event) => auditSafe(event),
    warn: (message, fields) => log.warn(message, fields),
  };
}

interface SigningIn {
  id: string;
  email: string;
  name: string | null;
  role: RoleName;
  passwordHash: string;
}

/** Creates the session row, records the sign-in and returns what goes into the JWT. */
async function finishSignIn(user: SigningIn, context: { ip: string | null; ua: string | null; mfa: boolean }) {
  const authSecret = getEnv().AUTH_SECRET;
  if (!authSecret) throw new Error("AUTH_SECRET is not set");

  const known = await isKnownDevice(user.id, context.ip, context.ua);
  const session = await createSession({
    userId: user.id,
    ip: context.ip,
    userAgent: context.ua,
    mfaVerified: context.mfa,
  });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await auditSafe({
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
    after(async () => {
      const rendered = newLogin({
        name: user.name,
        ip: context.ip,
        browser: parsed.browser,
        os: parsed.os,
        when: new Date().toUTCString(),
      });
      await sendEmail(
        { to: user.email, subject: rendered.subject, html: rendered.html, text: rendered.text, category: "security" },
        { actor: { id: user.id, email: user.email } }
      ).catch(() => undefined);
    });
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
    if (!(await limit("login:ip", ip)).ok) throw new LimitedLogin();
    const owner = await challengeOwner(credentials.challengeId, "SIGN_IN");
    if (!owner || owner.user.disabledAt) throw new InvalidLogin();
    if (!(await consumeChallenge({ challengeId: credentials.challengeId, userId: owner.userId, purpose: "SIGN_IN" }))) {
      throw new InvalidLogin();
    }
    const user = await db.user.findUnique({
      where: { id: owner.userId },
      select: { id: true, email: true, name: true, role: true, passwordHash: true },
    });
    if (!user) throw new InvalidLogin();
    return finishSignIn({ ...user, role: user.role as RoleName }, { ip: knownIp, ua, mfa: true });
  }

  const result = await verifyCredentials(
    { email: credentials.email, password: credentials.password, ip, userAgent: ua },
    credentialDeps()
  );
  if (!result.ok) {
    if (result.reason === "limited") throw new LimitedLogin();
    throw new InvalidLogin();
  }
  // A right password is not enough for an account with a second factor: the
  // sign-in action sends the code, and the session only starts after it.
  if (result.user.mfaEnabled) throw new MfaLogin();

  return finishSignIn(result.user, { ip: knownIp, ua, mfa: false });
}

function buildConfig(): NextAuthConfig {
  const env = getEnv();
  const production = process.env.NODE_ENV === "production";
  return {
    secret: env.AUTH_SECRET,
    trustHost: env.AUTH_TRUST_HOST || !production,
    // Never in production, and the debug logger stays silent either way: Auth.js
    // logs the request body (the typed password included) when authorize fails
    // with something other than a sign-in error.
    debug: !production && env.AUTH_DEBUG,
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
        options: { httpOnly: true, sameSite: "lax", path: "/", secure: production },
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
        session.user.id = token.sub ?? "";
        session.sid = token.sid ?? "";
        session.role = token.role ?? "EDITOR";
        session.pwf = token.pwf ?? "";
        session.mfa = token.mfa ?? false;
        return session;
      },
    },
  };
}

// Built per request so the secrets are read when needed, never at build time.
export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(() => buildConfig());
