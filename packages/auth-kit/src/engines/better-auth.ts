import type { BetterAuthPlugin } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAuthorize } from "../authorize";
import { createAuthKitBetterAuth, type AuthKitBetterAuth } from "../better-auth/instance";
import { betterAuthSessionSource, signInRefusal } from "../better-auth/sessions";
import type { AuthEngine, AuthEngineOptions, SignInCredentials } from "./types";

// auth-kit on Better Auth, for Next.js server code. auth-kit's authorize
// still decides who signs in; Better Auth issues the session, a user_sessions
// row whose token column holds the SHA-256 of the cookie token. No Better Auth
// route needs mounting: everything here calls `auth.api` directly. For a
// non-Next server (Hono), use createAuthKitBetterAuth from `./better-auth`.

export type * from "./types";

export function createAuthEngine(options: AuthEngineOptions): AuthEngine {
  let instance: Promise<AuthKitBetterAuth> | undefined;
  // Built on first use (resolving the database adapter is async); a failed
  // build is retried on the next call instead of being cached.
  const getAuth = () =>
    (instance ??= createAuthKitBetterAuth({
      database: options.database,
      authorize: createAuthorize(options.signIn),
      secret: options.signIn.authSecret,
      origins: options.origins,
      sessionCookieName: options.sessionCookieName,
      production: options.production,
      // nextCookies() writes Better Auth's cookies from server actions; it must stay last.
      plugins: [...((options.betterAuth?.plugins ?? []) as BetterAuthPlugin[]), nextCookies()],
    }).catch((error: unknown) => {
      instance = undefined;
      throw error;
    }));
  const requestHeaders = async () => new Headers(await headers());

  return {
    name: "better-auth",
    // Sessions are rows with no password fingerprint; a password change revokes the other rows instead.
    checkPasswordFingerprint: false,
    async sessionSource() {
      return betterAuthSessionSource(await getAuth(), requestHeaders)();
    },
    async signIn(credentials) {
      const auth = await getAuth();
      try {
        await auth.api.authKitSignIn({ body: credentials as SignInCredentials, headers: await requestHeaders() });
        return null;
      } catch (error) {
        const code = signInRefusal(error);
        if (code === null) throw error;
        return { code };
      }
    },
    async signOut(redirectTo) {
      const auth = await getAuth();
      await auth.api.authKitClearSession({ headers: await requestHeaders() });
      redirect(redirectTo);
    },
    // Nothing to refresh: the session is its row, which a password change leaves valid.
    async keepSessionAfterPasswordChange() {},
  };
}
