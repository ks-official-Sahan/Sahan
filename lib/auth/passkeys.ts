import "server-only";

import { createPasskeys } from "@sahan-sac/auth-kit/webauthn";

import { SiteMetadata } from "@/config/site";
import { auditSafe } from "@/lib/admin/audit";
import { authAdapter } from "@/lib/data";

import { AUTH_SECRET } from "./kit";
import { mfa } from "./mfa";

// Passkeys (WebAuthn) for the second sign-in step. The relying party is the
// site's own domain in production. A development build runs on localhost,
// which browsers accept as a secure context, so passkeys work there too.

const site = new URL(SiteMetadata.siteUrl);
const production = process.env.NODE_ENV === "production";

export const passkeys = createPasskeys({
  adapter: authAdapter,
  mfa,
  authSecret: AUTH_SECRET,
  audit: auditSafe,
  rpName: SiteMetadata.title,
  rpID: production ? site.hostname : "localhost",
  origin: production ? [site.origin, `https://www.${site.hostname}`] : ["http://localhost:3000", "http://localhost:3001"],
});
