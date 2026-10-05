import { parseShortLink } from "@sahan-sac/auth-kit/short-link-path";

/** An auth-kit short link from an email or a copy button. Same shape as auth-kit's `ShortLink`. */
export type AuthLink =
  /** `/a/<token>` (invite or password reset) or `/e/<token>` (email-change confirmation). */
  | { kind: "account" | "email"; token: string }
  /** `/s/<code>[/<path>]`: a sign-in link that unlocks the admin login, then opens `next`. */
  | { kind: "signIn"; code: string; next: string };

/**
 * The auth-kit link a URL holds, or null. For a universal link (iOS) or App
 * Link (Android) on your site's domain: only `siteUrl`'s origin counts, so a
 * look-alike host is never treated as yours. Nothing is verified here; the
 * server checks every token and code when the link is opened, so hand the
 * link to the browser (`WebBrowser.openBrowserAsync(url)`) rather than
 * trusting it on the device.
 */
export function parseAuthLink(url: string, siteUrl: string): AuthLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== new URL(siteUrl).origin) return null;
  return parseShortLink(parsed.pathname, parsed.search);
}
