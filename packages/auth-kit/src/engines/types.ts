import type { AuthorizeDeps } from "../authorize";

// The contract both auth engines implement. Engine-free on purpose: an app
// imports one engine (`./engines/next-auth` or `./engines/better-auth`), and
// both take these options and return this shape, so switching engines is
// changing that one import (and the matching `/cookie` import in the proxy).

export type SignInCredentials = { email: string; password: string } | { challengeId: string };

/** Why a sign-in was refused: wrong credentials, rate limited, or an emailed code is needed first. */
export type SignInRefusalCode = "invalid" | "limited" | "mfa_required";

/**
 * The app's database, for the engines that need one (Better Auth). next-auth
 * ignores it: its session is a JWT pointing at the row the session store writes.
 * - `{ prisma }`: a PrismaClient.
 * - `{ drizzle }`: a Drizzle client on a node-postgres or @neondatabase/serverless Pool (its `$client`).
 * - `{ pool }`: that Pool itself, for Kysely or plain SQL apps.
 */
export type AuthKitDatabase = { prisma: unknown } | { drizzle: unknown } | { pool: unknown };

export interface AuthEngineOptions {
  /** Everything auth-kit's sign-in decision needs (createAuthorize's deps); its `authSecret` also signs the session. */
  signIn: AuthorizeDeps;
  database: AuthKitDatabase;
  production: boolean;
  /** Resolve with `authKit.sessionCookieName(production)` (`__Host-`-prefixed in production). */
  sessionCookieName: string;
  /** Where next-auth's sign-in and error pages point. */
  loginPath: string;
  /** Role a session falls back to when it carries none (defensive only). */
  defaultRole: string;
  /** Every origin the site answers on; the first is the canonical one. */
  origins: readonly string[];
  /** next-auth only. Both default to the AUTH_TRUST_HOST and AUTH_DEBUG environment variables. */
  nextAuth?: { trustHost?: boolean; debug?: boolean };
  /** Better Auth only: extra plugins, added after auth-kit's own. */
  betterAuth?: { plugins?: readonly unknown[] };
}

/** What createAuthDal's `auth` dependency reads. */
export interface EngineSession {
  sid?: string;
  user?: { id?: string };
  pwf?: string;
}

export interface AuthEngine {
  readonly name: "next-auth" | "better-auth";
  /** createAuthDal's `auth` dependency. */
  sessionSource(): Promise<EngineSession | null>;
  /** createAuthDal's `checkPasswordFingerprint`: true for JWT sessions, which carry one. */
  readonly checkPasswordFingerprint: boolean;
  /** Null on success (the session cookie is set), else why it was refused. */
  signIn(credentials: SignInCredentials | Record<string, string>): Promise<{ code: SignInRefusalCode } | null>;
  /** Clears the session cookies and redirects. Revoke the session row first. */
  signOut(redirectTo: string): Promise<never>;
  /** Keeps the current session valid after its own password change. */
  keepSessionAfterPasswordChange(passwordHash: string): Promise<void>;
}

/** The request parts a cookie check reads. A NextRequest fits. */
export interface CookieRequest {
  cookies: { get(name: string): { value: string } | undefined };
  headers: Headers;
}

export interface SessionCookieCheck {
  /** Every cookie that holds the session, for the route that clears a revoked one. */
  readonly sessionCookies: readonly string[];
  /** Optimistic check for the proxy. The data access layer makes the real one. */
  hasSessionCookie(request: CookieRequest): Promise<boolean>;
}
