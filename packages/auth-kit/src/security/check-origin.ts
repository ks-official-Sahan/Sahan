import { isAllowedOrigin } from "./origin";

function extraOriginsFromEnv(): string[] {
  return (process.env.ADMIN_ALLOWED_ORIGINS ?? "")
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Convenience wrapper for checking origin in route handlers. */
export function checkOrigin(
  headerList: Headers,
  request?: { headers: Headers },
  config: { siteUrl?: string; extraOrigins?: string[] } = { siteUrl: process.env.SITE_URL, extraOrigins: extraOriginsFromEnv() }
): boolean {
  const origin = headerList.get("origin");
  const host = headerList.get("host");
  const forwardedHost = headerList.get("x-forwarded-host");

  return isAllowedOrigin(origin, {
    hosts: [host, forwardedHost],
    siteUrl: config.siteUrl,
    extraOrigins: config.extraOrigins ?? [],
  });
}
