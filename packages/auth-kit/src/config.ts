import { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import type { RoleName } from "./adapter";
import { createAuthorize, type AuthorizeDeps } from "./authorize";
import { SESSION_MAX_AGE_SECONDS } from "./constants";

// Auth.js with a credentials provider and a 24 hour JWT. The JWT only points at
// a DB session row (`sid`); the row decides whether it still counts (the
// app's data access layer, built with `createAuthDal`). The actual
// credentials decision lives in `./authorize` (`createAuthorize`), kept out
// of this file because it must not import `next-auth` — see that file's
// header comment for why.

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

export interface AuthConfigDeps extends AuthorizeDeps {
  authTrustHost: boolean;
  authDebug: boolean;
  production: boolean;
  /** Cookie name for the Auth.js session token. Resolve with `resolveCookieName` for the `__Host-`-prefixed production form. */
  sessionCookieName: string;
  /** Where `pages.signIn`/`pages.error` point. For example `"/admin/login"`. */
  loginPath: string;
  /** Role written into the session when a token carries none (defensive fallback only). */
  defaultRole: RoleName;
}

export function createAuthConfig(deps: AuthConfigDeps): NextAuthConfig {
  const authorize = createAuthorize(deps);

  return {
    secret: deps.authSecret,
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
    pages: { signIn: deps.loginPath, error: deps.loginPath },
    cookies: {
      sessionToken: {
        name: deps.sessionCookieName,
        options: { httpOnly: true, sameSite: "lax", path: "/", secure: deps.production },
      },
    },
    providers: [
      Credentials({
        credentials: { email: {}, password: {}, challengeId: {} },
        async authorize(credentials, request) {
          const result = await authorize(credentials, request);
          switch (result.kind) {
            case "signed_in":
              return result.session;
            case "limited":
              throw new LimitedLogin();
            case "mfa_required":
              throw new MfaLogin();
            case "invalid":
            default:
              throw new InvalidLogin();
          }
        },
      }),
    ],
    callbacks: {
      jwt({ token, user, trigger, session }) {
        if (user) {
          token.sub = user.id;
          token.sid = user.sid;
          // A consuming app's own ambient augmentation of next-auth's `User`
          // (see next-auth.d.ts) may declare `role` narrower than this
          // package's own `string`-typed default; cast to whatever the
          // token's own merged type actually is, the same defensive pattern
          // the `session` callback below already uses for the same reason.
          token.role = user.role as typeof token.role;
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
        session.role = (token.role as RoleName | undefined) ?? deps.defaultRole;
        session.pwf = (token.pwf as string | undefined) ?? "";
        session.mfa = (token.mfa as boolean | undefined) ?? false;
        return session;
      },
    },
  };
}
