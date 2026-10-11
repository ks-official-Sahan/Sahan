import "server-only";

import { createPasskeys } from "@sahan-sac/auth-kit/webauthn";

import { SiteMetadata } from "@/config/site";
import { audit, auditSafe } from "@/lib/admin/audit";
import { kv } from "@/lib/cache/redis";
import { authAdapter, reposFor } from "@/lib/data";
import { getSetting } from "@/lib/settings/service";

import { AUTH_SECRET } from "./kit";
import { authKit } from "./kit-config";
import { mfa } from "./mfa";

// Passkeys (WebAuthn) for the second sign-in step and, when the
// security.passkeySignIn setting is on, for signing in with a passkey alone.
// The relying party is the site's own domain in production. A development
// build runs on localhost, which browsers accept as a secure context, so
// passkeys work there too.

const site = new URL(SiteMetadata.siteUrl);
const production = process.env.NODE_ENV === "production";
// The apex and its www twin both serve the site; the relying party is the apex.
const apex = site.hostname.replace(/^www\./, "");

export const passkeys = createPasskeys({
  adapter: authAdapter,
  mfa,
  authSecret: AUTH_SECRET,
  audit: (event, tx) => (tx ? audit(event, reposFor(tx)) : auditSafe(event)),
  rpName: SiteMetadata.title,
  rpID: production ? apex : "localhost",
  origin: production ? [`https://${apex}`, `https://www.${apex}`] : ["http://localhost:3000", "http://localhost:3001"],
  // Passwordless challenges: one Redis key each, taken once (DEL count).
  challengeStore: {
    put: async (key, ttlSeconds) => void (await kv.set(`${authKit.keyPrefix}${key}`, 1, { ttlSeconds })),
    take: async (key) => (await kv.del(`${authKit.keyPrefix}${key}`)) === 1,
  },
});

/** Whether a passkey alone may sign in (Settings, DEVELOPER only). */
export async function passkeySignInEnabled(): Promise<boolean> {
  return (await getSetting("security.passkeySignIn")).enabled;
}
