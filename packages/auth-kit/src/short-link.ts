import { verifyTokenTag } from "./invite-token";
import { verifySignInLink, type UnlockKeys } from "./login-unlock";
import { shortLinkTarget, type ShortLink, type ShortLinkPaths } from "./short-link-path";

export * from "./short-link-path";

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
