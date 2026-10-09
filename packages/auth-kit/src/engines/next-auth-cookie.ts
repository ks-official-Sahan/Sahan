import { getToken } from "next-auth/jwt";

import type { CookieRequest, SessionCookieCheck } from "./types";

// next-auth's session cookie, for proxy.ts: checks the JWT's signature and
// expiry without loading the engine.

export function createSessionCookieCheck(options: { cookieName: string; secret?: string }): SessionCookieCheck {
  return {
    sessionCookies: [options.cookieName],
    async hasSessionCookie(request: CookieRequest) {
      if (!options.secret) return false;
      try {
        const token = await getToken({ req: request as never, secret: options.secret, cookieName: options.cookieName, salt: options.cookieName });
        return Boolean(token?.sid);
      } catch {
        return false;
      }
    },
  };
}

export type * from "./types";
