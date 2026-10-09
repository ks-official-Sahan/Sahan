import { DEFAULT_CALLBACK, safeCallbackUrl } from "./safe-callback-url";

// The pure half of ./short-link: link shapes, parsing and path builders, with
// no node:crypto import, so a React Native app (@sahan-sac/auth-kit-client) or
// an edge runtime can recognise a link without the verification code.

export const SHORT_LINK_PREFIX = { account: "/a/", email: "/e/", signIn: "/s/" } as const;

export type AccountShortLink = { kind: "account" | "email"; token: string };
export type SignInShortLink = { kind: "signIn"; code: string; next: string };
export type ShortLink = AccountShortLink | SignInShortLink;

/** Where account and email links land; `AuthKitPaths` from `defineAuthKit` fits. */
export interface ShortLinkPaths {
  setPassword: string;
  confirmEmail: string;
}

const DEFAULT_PATHS: ShortLinkPaths = { setPassword: "/admin/set-password", confirmEmail: "/admin/confirm-email" };

const SHORT_LINK = /^\/([aes])\/([A-Za-z0-9_.-]{1,128})(\/.*)?$/;

/** The short link a path names, or null. `search` (with its `?`) rides along on a sign-in link. */
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
export const shortLinkTarget = (link: AccountShortLink, paths: ShortLinkPaths = DEFAULT_PATHS) =>
  `${link.kind === "account" ? paths.setPassword : paths.confirmEmail}?token=${encodeURIComponent(link.token)}`;

export const accountLinkPath = (token: string) => `${SHORT_LINK_PREFIX.account}${token}`;
export const emailLinkPath = (token: string) => `${SHORT_LINK_PREFIX.email}${token}`;

/** `next` is an /admin path; what follows /admin rides in the short link's own path. */
export const signInLinkPath = (code: string, next: string = DEFAULT_CALLBACK) =>
  `${SHORT_LINK_PREFIX.signIn}${code}${safeCallbackUrl(next).slice(DEFAULT_CALLBACK.length)}`;
