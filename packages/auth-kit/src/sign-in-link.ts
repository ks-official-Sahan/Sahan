import { signInLinkDays, signSignInLink, type UnlockKeys } from "./login-unlock";
import { signInLinkPath } from "./short-link-path";

export interface PreparedSignInLink {
  /** Short path such as `/s/<code>`, ready to prefix with the site origin. */
  path: string;
  expiresAt: Date;
  days: number;
}

/**
 * A sign-in link for one email: it only opens the hidden sign-in page.
 * The app turns `path` into an absolute URL and sends the message.
 * Rotating the unlock secret or the auth secret ends every link at once.
 */
export function prepareSignInLink(input: {
  now?: number;
  days?: string | number | null;
  keys: UnlockKeys;
  next?: string;
}): PreparedSignInLink {
  const now = input.now ?? Date.now();
  const days = signInLinkDays(input.days);
  return {
    path: signInLinkPath(signSignInLink(now, days, input.keys), input.next),
    expiresAt: new Date(now + days * 24 * 60 * 60 * 1000),
    days,
  };
}
