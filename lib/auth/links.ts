import "server-only";

import { loginUnlockEnabled, signInLinkDays, signSignInLink, unlockKeysFromEnv } from "@sahan-sac/auth-kit/login-unlock";

import { getEnv } from "@/lib/env";
import { absoluteUrl } from "@/lib/site-url";

import { accountLinkPath, emailLinkPath, signInLinkPath } from "./short-links";

// Absolute short links for emails and copy buttons (lib/auth/short-links.ts).

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
export function signInLink(next = "/admin", now = Date.now()): SignInLink {
  const keys = loginUnlockEnabled() ? unlockKeysFromEnv() : null;
  if (!keys) return { url: absoluteUrl(next), expiresAt: null };
  const days = signInLinkDays(getEnv().ADMIN_SIGN_IN_LINK_DAYS);
  return {
    url: absoluteUrl(signInLinkPath(signSignInLink(now, days, keys), next)),
    expiresAt: new Date(now + days * 24 * 60 * 60 * 1000),
  };
}
