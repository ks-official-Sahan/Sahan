import type { CookieRequest, SessionCookieCheck } from "./types";

// Better Auth's session cookies, without importing Better Auth: proxy.ts loads
// this on every request.

/** Better Auth's signed copy of the session (the cookie cache), next to the session cookie. */
export const sessionDataCookie = (sessionCookieName: string) => `${sessionCookieName}_data`;

export function createSessionCookieCheck(options: { cookieName: string; secret?: string }): SessionCookieCheck {
  return {
    sessionCookies: [options.cookieName, sessionDataCookie(options.cookieName)],
    // The token is opaque here: presence is the optimistic check.
    hasSessionCookie: async (request: CookieRequest) => Boolean(request.cookies.get(options.cookieName)?.value),
  };
}

export type * from "./types";
