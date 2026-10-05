import { verifyTokenTag } from "./invite-token";
import { verifySignInLink, type UnlockKeys } from "./login-unlock";
import { DEFAULT_CALLBACK, safeCallbackUrl } from "./safe-callback-url";

// Short links for emails and copy buttons. Each is a redirect a proxy can
// answer without a database read:
//   /a/<token>          invite and reset links, to the set-password page
//   /e/<token>          email-change confirmation, to the confirm-email page
//   /s/<code>[/<path>]  sign-in link: unlocks the hidden login page, then /admin[/<path>]
// A token keeps its HMAC tag (./invite-token) and a sign-in code is signed
// (./login-unlock), so a forged link is refused before any redirect. The page a
// link lands on still checks the token in the database (single use, expiry).
// Framework-agnostic and free of server-only imports: a Next.js proxy, a Hono
// middleware or a test can all run it. The paths are one letter, so an app
// using these links must keep /a, /e and /s free of its own pages.

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

export type ShortLinkDecision =
  /** Redirect to `location`; with `unlock`, also set the unlock cookie (`signUnlockCookie`). */
  | { kind: "redirect"; location: string; unlock: boolean }
  /** Answer the app's ordinary 404, never a distinct error. */
  | { kind: "locked"; reason: "bad_token" | "bad_code" | "rate_limited" | "not_configured" };

export interface ShortLinkDeps {
  /** Verifies the tag of an account or email token. */
  authSecret: string | undefined;
  /** `loginUnlockEnabled()`: with the gate off, a sign-in link is a plain redirect. */
  unlockGate: boolean;
  /** `unlockKeysFromEnv()`. */
  keys: UnlockKeys | null;
  now: number;
  paths?: ShortLinkPaths;
  /** Called for a sign-in link while the gate is on; false refuses it. Share the ?secret= bucket. */
  rateLimit?: () => Promise<boolean>;
}

/** What to answer for a short link. Every secret arrives as a parameter. */
export async function resolveShortLink(link: ShortLink, deps: ShortLinkDeps): Promise<ShortLinkDecision> {
  if (link.kind !== "signIn") {
    return verifyTokenTag(link.token, deps.authSecret)
      ? { kind: "redirect", location: shortLinkTarget(link, deps.paths), unlock: false }
      : { kind: "locked", reason: "bad_token" };
  }
  if (!deps.unlockGate) return { kind: "redirect", location: link.next, unlock: false };
  if (!deps.keys) return { kind: "locked", reason: "not_configured" };
  if (deps.rateLimit && !(await deps.rateLimit())) return { kind: "locked", reason: "rate_limited" };
  if (!verifySignInLink(link.code, deps.now, deps.keys)) return { kind: "locked", reason: "bad_code" };
  return { kind: "redirect", location: link.next, unlock: true };
}
