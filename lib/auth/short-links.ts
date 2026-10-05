import { DEFAULT_CALLBACK, safeCallbackUrl } from "@sahan-sac/auth-kit/safe-callback-url";

import { CONFIRM_EMAIL_PATH, SET_PASSWORD_PATH } from "./constants";

// Short links for emails and copied links. The proxy answers each with a
// redirect and never reads the database:
//   /a/<token>          invite and reset links, to the set-password page
//   /e/<token>          email-change confirmation, to the confirm-email page
//   /s/<code>[/<path>]  sign-in link: unlocks the login page, then /admin[/<path>]
// A token keeps its HMAC tag and a sign-in code is signed, so the proxy
// refuses a forged one before it redirects. No server-only import: proxy.ts
// runs this. The paths are one letter, so no public page may use /a, /e or /s.

export type AccountShortLink = { kind: "account" | "email"; token: string };
export type ShortLink = AccountShortLink | { kind: "signIn"; code: string; next: string };

const SHORT_LINK = /^\/([aes])\/([A-Za-z0-9_.-]{1,128})(\/.*)?$/;

export function parseShortLink(pathname: string, search = ""): ShortLink | null {
  const match = SHORT_LINK.exec(pathname);
  if (!match) return null;
  const [, kind, value, rest = ""] = match;
  if (kind === "s") {
    return { kind: "signIn", code: value, next: safeCallbackUrl(`${DEFAULT_CALLBACK}${rest === "/" ? "" : rest}${search}`) };
  }
  if (rest) return null;
  return { kind: kind === "a" ? "account" : "email", token: value };
}

/** Where a verified account or email link goes. */
export const shortLinkTarget = (link: AccountShortLink) =>
  `${link.kind === "account" ? SET_PASSWORD_PATH : CONFIRM_EMAIL_PATH}?token=${encodeURIComponent(link.token)}`;

export const accountLinkPath = (token: string) => `/a/${token}`;
export const emailLinkPath = (token: string) => `/e/${token}`;

/** `next` is an /admin path; what follows /admin rides in the short link's own path. */
export const signInLinkPath = (code: string, next: string = DEFAULT_CALLBACK) =>
  `/s/${code}${safeCallbackUrl(next).slice(DEFAULT_CALLBACK.length)}`;
