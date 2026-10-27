import "server-only";

import { loginUnlockEnabled, unlockKeysFromEnv, verifySignInLink } from "@sahan-sac/auth-kit/login-unlock";
import { prepareSignInLink } from "@sahan-sac/auth-kit/sign-in-link";
import { accountLinkPath, emailLinkPath, parseShortLink, signInLinkPath } from "@sahan-sac/auth-kit/short-link";

import { getEnv } from "@/lib/env";
import { absoluteUrl } from "@/lib/site-url";

// Absolute short links for emails and copy buttons (@sahan-sac/auth-kit/short-link),
// on the active site domain (lib/site-url.ts).

/** Invite and password-reset links: open the set-password page. */
export const accountLink = (token: string) => absoluteUrl(accountLinkPath(token));

/** Email-change confirmation links. */
export const emailLink = (token: string) => absoluteUrl(emailLinkPath(token));

export interface SignInLink {
  url: string;
  /** Null when the hidden-login gate is off and the link is a plain /admin URL. */
  expiresAt: Date | null;
}

/**
 * A link that opens the login page (then `next`, an /admin path) without the
 * unlock secret. Valid ADMIN_SIGN_IN_LINK_DAYS days (default 14, at most 90);
 * rotating ADMIN_LOGIN_UNLOCK_SECRET or AUTH_SECRET ends every link at once.
 * With the gate off, the plain admin URL.
 */
export async function signInLink(next = "/admin", now = Date.now()): Promise<SignInLink> {
  const keys = loginUnlockEnabled() ? unlockKeysFromEnv() : null;
  if (!keys) return { url: await absoluteUrl(next), expiresAt: null };
  const prepared = prepareSignInLink({ now, days: getEnv().ADMIN_SIGN_IN_LINK_DAYS, keys, next });
  return { url: await absoluteUrl(prepared.path), expiresAt: prepared.expiresAt };
}

/** The link shown on Account, if it is still a sign-in link this server signed. The host is rebuilt. */
export async function acceptedSignInLink(raw: string, now = Date.now()): Promise<SignInLink | null> {
  let pathname = "";
  let search = "";
  try {
    const url = new URL(raw);
    pathname = url.pathname;
    search = url.search;
  } catch {
    return null;
  }
  const parsed = parseShortLink(pathname, search);
  if (parsed?.kind !== "signIn") return null;
  const keys = loginUnlockEnabled() ? unlockKeysFromEnv() : null;
  if (!keys || !verifySignInLink(parsed.code, now, keys)) return null;
  const expiresAt = new Date(parseInt(parsed.code.split(".")[0], 36) * 1000);
  if (Number.isNaN(expiresAt.getTime())) return null;
  return { url: await absoluteUrl(signInLinkPath(parsed.code, parsed.next)), expiresAt };
}
