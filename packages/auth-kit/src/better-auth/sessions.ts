import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { deleteSessionCookie, setSessionCookie } from "better-auth/cookies";

import type { AuthorizeResult, createAuthorize } from "../authorize";
import { SESSION_MAX_AGE_SECONDS } from "../constants";
import { describeAgent } from "../session/store";

// Better Auth on auth-kit's own tables. auth-kit keeps deciding who may sign
// in (the same `authorize` the next-auth engine uses: lockout, IP limit,
// emailed MFA codes, known-device email, audit), and Better Auth issues and
// reads the session: a `user_sessions` row with a cookie token. Every other
// Better Auth route that could create a user, set a password or end a session
// behind auth-kit's back is switched off with AUTH_KIT_DISABLED_PATHS.

export type AuthKitOrm = "prisma" | "drizzle";

/**
 * Model names and session settings that point Better Auth at auth-kit's
 * `users` and `user_sessions` tables. Spread into `betterAuth({...})`.
 * Sessions last SESSION_MAX_AGE_SECONDS from sign-in, as on the next-auth
 * engine, and are never extended. The cookie cache only saves the token
 * lookup: the session state check in createAuthDal still runs every request.
 *
 * Better Auth's startup schema check is off: it expects its own `account` and
 * `verification` tables and a `users` table it can insert into, and in this
 * setup it never touches the first two or inserts users (AUTH_KIT_DISABLED_PATHS
 * switches off every route that would). If you merge your own `advanced`
 * options, keep `database.validateSchema: false` in them.
 */
export function authKitDatabaseOptions(orm: AuthKitOrm) {
  return {
    user: { modelName: orm === "prisma" ? "user" : "users" },
    session: {
      modelName: orm === "prisma" ? "userSession" : "userSessions",
      fields: { ipAddress: "ip" },
      expiresIn: SESSION_MAX_AGE_SECONDS,
      disableSessionRefresh: true,
      cookieCache: { enabled: true, maxAge: 300 },
    },
    advanced: { database: { validateSchema: false } },
  } satisfies Pick<BetterAuthOptions, "user" | "session" | "advanced">;
}

/**
 * Better Auth routes that would sidestep auth-kit: its own sign-in and sign-up,
 * password and email changes, account linking, and session routes that delete
 * rows instead of revoking them. Pass as `disabledPaths`.
 */
export const AUTH_KIT_DISABLED_PATHS = [
  "/sign-in/email",
  "/sign-in/social",
  "/callback/:id",
  "/sign-up/email",
  "/sign-out",
  "/update-session",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/update-user",
  "/delete-user",
  "/delete-user/callback",
  "/change-email",
  "/change-password",
  "/verify-password",
  "/request-password-reset",
  "/reset-password",
  "/reset-password/:token",
  "/send-verification-email",
  "/verify-email",
  "/link-social",
  "/list-accounts",
  "/unlink-account",
  "/account-info",
  "/refresh-token",
  "/get-access-token",
];

export interface AuthKitSessionsOptions {
  /** auth-kit's sign-in decision, from createAuthorize. */
  authorize: ReturnType<typeof createAuthorize>;
  /**
   * The login-unlock gate: false hides sign-in (404) for this request, e.g.
   * when the request carries no valid unlock cookie. Leave out to allow all.
   */
  canSignIn?: (headers: Headers) => boolean | Promise<boolean>;
}

type Refusal = Exclude<AuthorizeResult["kind"], "signed_in">;

const REFUSALS: Record<Refusal, { status: "UNAUTHORIZED" | "TOO_MANY_REQUESTS" | "FORBIDDEN"; message: string }> = {
  invalid: { status: "UNAUTHORIZED", message: "Invalid email or password." },
  limited: { status: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Try again later." },
  mfa_required: { status: "FORBIDDEN", message: "A sign-in code is required." },
};

/** The refusal code of an error thrown by `authKitSignIn`, or null for any other error. */
export function signInRefusal(error: unknown): Refusal | null {
  if (!(error instanceof APIError)) return null;
  const code = (error.body as { code?: unknown } | undefined)?.code;
  return typeof code === "string" && Object.hasOwn(REFUSALS, code) ? (code as Refusal) : null;
}

const str = (value: unknown) => (typeof value === "string" ? value : undefined);

/** Typing only: the handler checks every field itself, so no schema library is needed. */
type SignInBody = { email: string; password: string } | { challengeId: string };

/**
 * The Better Auth plugin for apps on auth-kit's tables. Adds:
 * - `POST /auth-kit/sign-in` (`auth.api.authKitSignIn`): body `{ email, password }`,
 *   or `{ challengeId }` once the emailed code for that challenge is verified.
 *   Sets the session cookie, or throws an APIError whose `body.code` is
 *   "invalid", "limited" or "mfa_required" (read it with `signInRefusal`).
 * - `POST /auth-kit/clear-session` (`auth.api.authKitClearSession`): removes the
 *   session cookies. Revoke the row first (the session store's revokeSession),
 *   so the ended session stays in the sessions list.
 */
export function authKitSessions(options: AuthKitSessionsOptions) {
  return {
    id: "auth-kit-sessions",
    schema: {
      user: {
        fields: {
          role: { type: "string", required: false, input: false },
          mustChangePassword: { type: "boolean", required: false, input: false },
          mfaEnabled: { type: "boolean", required: false, input: false },
        },
      },
      session: {
        fields: {
          browser: { type: "string", required: false, input: false },
          os: { type: "string", required: false, input: false },
          device: { type: "string", required: false, input: false },
          mfaVerified: { type: "boolean", required: false, defaultValue: false, input: false },
        },
      },
    },
    endpoints: {
      authKitSignIn: createAuthEndpoint("/auth-kit/sign-in", { method: "POST", metadata: { $Infer: { body: {} as SignInBody } } }, async (ctx) => {
        const headers = ctx.headers ?? ctx.request?.headers ?? new Headers();
        if (options.canSignIn && !(await options.canSignIn(headers))) throw new APIError("NOT_FOUND");

        const body: Record<string, unknown> = ctx.body ?? {};
        const challengeId = str(body.challengeId);
        const credentials = challengeId ? { challengeId } : { email: str(body.email), password: str(body.password) };

        let created: Awaited<ReturnType<typeof ctx.context.internalAdapter.createSession>> | null = null;
        const result = await options.authorize(credentials, { headers }, {
          createSession: async (input) => {
            const userAgent = input.userAgent?.slice(0, 1024) ?? null;
            // overrideAll: these values win over Better Auth's own defaults.
            created = await ctx.context.internalAdapter.createSession(
              input.userId,
              false,
              { ipAddress: input.ip, userAgent, ...describeAgent(userAgent), mfaVerified: input.mfaVerified ?? false },
              true
            );
            if (!created) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Could not create the session." });
            return { id: created.id };
          },
        });

        if (result.kind !== "signed_in") {
          const refusal = REFUSALS[result.kind];
          throw new APIError(refusal.status, { code: result.kind, message: refusal.message });
        }
        const user = await ctx.context.internalAdapter.findUserById(result.session.id);
        if (!created || !user) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Could not create the session." });
        await setSessionCookie(ctx, { session: created, user });
        return ctx.json({ userId: user.id, sessionId: result.session.sid, mfa: result.session.mfa });
      }),
      authKitClearSession: createAuthEndpoint("/auth-kit/clear-session", { method: "POST" }, async (ctx) => {
        deleteSessionCookie(ctx);
        return ctx.json({ ok: true });
      }),
    },
  } satisfies BetterAuthPlugin;
}

/** The part of a Better Auth instance a session source needs. */
export interface BetterAuthGetSession {
  api: { getSession(input: { headers: Headers }): Promise<{ session: { id: string }; user: { id: string } } | null> };
}

/**
 * The `auth` dependency of createAuthDal, read from Better Auth's session
 * cookie. Pair it with `checkPasswordFingerprint: false`: these sessions carry
 * no `pwf` claim. `getHeaders` is the framework's request headers (Next.js:
 * `headers` from next/headers).
 */
export function betterAuthSessionSource(auth: BetterAuthGetSession, getHeaders: () => Headers | Promise<Headers>) {
  return async () => {
    const result = await auth.api.getSession({ headers: await getHeaders() });
    return result ? { sid: result.session.id, user: { id: result.user.id } } : null;
  };
}
