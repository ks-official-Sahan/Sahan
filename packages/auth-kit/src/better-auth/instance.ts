import { betterAuth, type BetterAuthOptions, type BetterAuthPlugin } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getAdapter } from "better-auth/db/adapter";

import type { createAuthorize } from "../authorize";
import { sessionDataCookie } from "../engines/better-auth-cookie";
import type { AuthKitDatabase, SignInCredentials } from "../engines/types";
import { withHashedSessionTokens, type HashableAdapter } from "./hash-tokens";
import { AUTH_KIT_DISABLED_PATHS, authKitDatabaseOptions, authKitSessions, type AuthKitOrm } from "./sessions";

// A Better Auth instance on auth-kit's tables, for any server: Next.js (the
// `./engines/better-auth` engine builds on this), Hono, or plain Node.

export interface AuthKitBetterAuthOptions {
  database: AuthKitDatabase;
  /** auth-kit's sign-in decision, from createAuthorize. */
  authorize: ReturnType<typeof createAuthorize>;
  secret: string;
  /** Every origin the site answers on; the first is Better Auth's baseURL. */
  origins: readonly string[];
  /** Renames Better Auth's cookies (`__Host-`-prefixed names need `production` for Secure). Default: Better Auth's names. */
  sessionCookieName?: string;
  production?: boolean;
  /** The login-unlock gate: false answers sign-in with 404. */
  canSignIn?: (headers: Headers) => boolean | Promise<boolean>;
  /** Added after auth-kit's own plugin. */
  plugins?: BetterAuthPlugin[];
}

/** The part of the instance auth-kit uses. `handler` serves `/api/auth/*` when a route is mounted (Hono). */
export interface AuthKitBetterAuth {
  handler(request: Request): Promise<Response>;
  api: {
    getSession(input: { headers: Headers }): Promise<{ session: { id: string }; user: { id: string } } | null>;
    authKitSignIn(input: { body: SignInCredentials; headers: Headers }): Promise<unknown>;
    authKitClearSession(input: { headers: Headers }): Promise<unknown>;
  };
}

function rawDatabase(database: AuthKitDatabase): { orm: AuthKitOrm; raw: BetterAuthOptions["database"] } {
  if ("prisma" in database) return { orm: "prisma", raw: prismaAdapter(database.prisma as never, { provider: "postgresql" }) };
  const pool = "pool" in database ? database.pool : (database.drizzle as { $client?: unknown } | null)?.$client;
  if (!pool || typeof pool !== "object" || !("connect" in pool)) {
    throw new Error("auth-kit: Better Auth needs { prisma: PrismaClient }, { pool: Pool } (node-postgres or @neondatabase/serverless), or { drizzle } on such a Pool.");
  }
  // Better Auth's built-in SQL path (Kysely) on the app's own pool: no ORM adapter to install.
  return { orm: "kysely", raw: pool as BetterAuthOptions["database"] };
}

export async function createAuthKitBetterAuth(options: AuthKitBetterAuthOptions): Promise<AuthKitBetterAuth> {
  const { orm, raw } = rawDatabase(options.database);
  const tables = authKitDatabaseOptions(orm);
  const cookieName = options.sessionCookieName;
  const base = {
    baseURL: options.origins[0],
    trustedOrigins: [...options.origins],
    secret: options.secret,
    ...tables,
    advanced: {
      ...tables.advanced,
      ...(cookieName
        ? {
            // A __Host- name must not get Better Auth's own __Secure- prefix; Secure is set explicitly instead.
            useSecureCookies: false,
            defaultCookieAttributes: { secure: options.production ?? false },
            cookies: { session_token: { name: cookieName }, session_data: { name: sessionDataCookie(cookieName) } },
          }
        : {}),
    },
    disabledPaths: AUTH_KIT_DISABLED_PATHS,
    plugins: [authKitSessions({ authorize: options.authorize, canSignIn: options.canSignIn }), ...(options.plugins ?? [])],
  } satisfies BetterAuthOptions;

  const adapter = withHashedSessionTokens((await getAdapter({ ...base, database: raw })) as unknown as HashableAdapter);
  return betterAuth({ ...base, database: () => adapter as never }) as unknown as AuthKitBetterAuth;
}
