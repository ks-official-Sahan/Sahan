import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

import type { AuditEvent } from "../audit-event";
import { hashPassword, verifyPassword } from "../password";
import { checkPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../password-policy";
import { clientIp, type ClientIpOptions, UNKNOWN_IP } from "../security/ip";

export * from "./sessions";

// The Better Auth engine. Better Auth owns sign-in, sessions, cookies, 2FA and
// the auth routes; this plugin adds auth-kit's policy on top of it, the same
// rules the next-auth engine enforces: a hidden sign-in form (login unlock),
// per-IP and per-account throttling, the password policy, audit events, and
// the role fields RBAC reads. Every dependency is injected, so the plugin
// never reads process.env, a database or Redis itself.
//
// This plugin is for apps on Better Auth's own tables. Apps on auth-kit's
// tables (users, user_sessions) use authKitSessions from ./sessions instead.

const SIGN_IN = "/sign-in/email";
/** Endpoints that set a password, and the body field each one sends it in. */
const PASSWORD_FIELDS: Record<string, "password" | "newPassword"> = {
  "/sign-up/email": "password",
  "/change-password": "newPassword",
  "/reset-password": "newPassword",
};

export interface AuthKitPluginOptions {
  /**
   * Throttles sign-in: called once per attempt for the caller's IP (when it is
   * known) and once for the account's lowercased email. `ok: false` refuses
   * the attempt with 429. Wire the app's own buckets (auth-kit's createRateLimit).
   */
  limit?: (bucket: "login:ip" | "login:acct", key: string) => Promise<{ ok: boolean }>;
  /**
   * The login-unlock gate: false hides sign-in (404) for this request, e.g.
   * when the request carries no valid unlock cookie. Leave out to allow all.
   */
  canSignIn?: (headers: Headers) => boolean | Promise<boolean>;
  /** Receives auth.login.success, auth.login.failure and auth.login.challenge events. */
  audit?: (event: AuditEvent) => Promise<void>;
  /** Role given to new users. Default "EDITOR". */
  defaultRole?: string;
  /** Enforce auth-kit's password policy on sign-up, password change and reset. Default true. */
  passwordPolicy?: boolean;
  /** Which proxy headers to believe for the caller IP (see ./security/ip). */
  clientIp?: ClientIpOptions;
}

export function authKit(options: AuthKitPluginOptions = {}) {
  const requestInfo = (headers: Headers | undefined) => {
    const h = headers ?? new Headers();
    const ip = clientIp(h, options.clientIp);
    return { headers: h, ip: ip === UNKNOWN_IP ? null : ip, userAgent: h.get("user-agent") };
  };

  return {
    id: "auth-kit",
    schema: {
      user: {
        fields: {
          role: { type: "string", required: false, defaultValue: options.defaultRole ?? "EDITOR", input: false },
          mustChangePassword: { type: "boolean", required: false, defaultValue: false, input: false },
        },
      },
    },
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === SIGN_IN,
          handler: createAuthMiddleware(async (ctx) => {
            const { headers, ip } = requestInfo(ctx.headers);
            if (options.canSignIn && !(await options.canSignIn(headers))) throw new APIError("NOT_FOUND");
            if (!options.limit) return;
            const email = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
            const checks = [ip ? options.limit("login:ip", ip) : null, email ? options.limit("login:acct", email) : null];
            const results = await Promise.all(checks);
            if (results.some((result) => result && !result.ok)) {
              throw new APIError("TOO_MANY_REQUESTS", { message: "Too many sign-in attempts. Try again later." });
            }
          }),
        },
        {
          matcher: (ctx) => options.passwordPolicy !== false && Object.hasOwn(PASSWORD_FIELDS, ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const field = PASSWORD_FIELDS[ctx.path ?? ""];
            const password = field ? ctx.body?.[field] : undefined;
            if (typeof password !== "string") return;
            const check = checkPassword(password, { email: ctx.body?.email, name: ctx.body?.name });
            if (!check.ok) throw new APIError("BAD_REQUEST", { message: check.problems.join(" ") });
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === SIGN_IN && Boolean(options.audit),
          handler: createAuthMiddleware(async (ctx) => {
            const { ip, userAgent } = requestInfo(ctx.headers);
            const session = ctx.context.newSession;
            const returned = ctx.context.returned;
            const email = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : null;
            if (session) {
              await options.audit!({
                action: "auth.login.success",
                actor: { id: session.user.id, email: session.user.email },
                entityType: "User",
                entityId: session.user.id,
                ip,
                userAgent,
              });
            } else if (returned instanceof APIError) {
              await options.audit!({ action: "auth.login.failure", entityType: "User", meta: { email, status: returned.status }, ip, userAgent });
            } else {
              // Right password, second factor still to come (the 2FA plugin withholds the session).
              await options.audit!({ action: "auth.login.challenge", entityType: "User", meta: { email }, ip, userAgent });
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}

/**
 * Email and password settings matching auth-kit: its length limits, and its
 * bcrypt hashes, so users created by the next-auth engine (or a previous
 * deploy) keep signing in after switching engines.
 */
export function authKitEmailPassword(overrides: Partial<NonNullable<BetterAuthOptions["emailAndPassword"]>> = {}) {
  return {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    password: {
      hash: (password: string) => hashPassword(password),
      verify: ({ hash, password }: { hash: string; password: string }) => verifyPassword(password, hash),
    },
    ...overrides,
  } satisfies BetterAuthOptions["emailAndPassword"];
}

/** The part of a Better Auth instance this module needs, so tests and apps can pass any instance. */
export interface BetterAuthSessionApi {
  api: {
    getSession(input: { headers: Headers }): Promise<{
      session: { id: string; expiresAt: Date };
      user: { id: string; email: string; name?: string | null; role?: string | null; mustChangePassword?: boolean | null; twoFactorEnabled?: boolean | null };
    } | null>;
  };
}

export interface KitSession {
  userId: string;
  sessionId: string;
  email: string;
  name: string | null;
  role: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  expiresAt: Date;
}

/** The signed-in user for a request, in auth-kit's shape, or null. */
export async function readBetterAuthSession(auth: BetterAuthSessionApi, headers: Headers, defaultRole = "EDITOR"): Promise<KitSession | null> {
  const result = await auth.api.getSession({ headers });
  if (!result) return null;
  const { session, user } = result;
  return {
    userId: user.id,
    sessionId: session.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role ?? defaultRole,
    mustChangePassword: Boolean(user.mustChangePassword),
    mfaEnabled: Boolean(user.twoFactorEnabled),
    expiresAt: session.expiresAt,
  };
}
