import { isAllowedOrigin, parseOriginList } from "./origin";

export interface CheckOriginConfig {
  siteUrl?: string | null;
  extraOrigins?: readonly string[];
}

/**
 * Convenience wrapper for checking origin in route handlers.
 *
 * `config` is optional so existing call sites that never had a config surface
 * to reach keep working, but every new caller should pass one explicitly
 * (`{ siteUrl, extraOrigins }`, resolved once by the app, for example from
 * `defineAuthKit`'s config) instead of relying on the default, which reads
 * `SITE_URL`/`ADMIN_ALLOWED_ORIGINS` from `process.env` directly. Both this
 * default and `proxy.ts`'s own origin check parse `ADMIN_ALLOWED_ORIGINS`
 * through the same `parseOriginList` (see `./origin`), so there is exactly
 * one parser for that value instead of two that could drift apart.
 */
export function checkOrigin(
  headerList: Headers,
  request?: { headers: Headers },
  config: CheckOriginConfig = { siteUrl: process.env.SITE_URL, extraOrigins: parseOriginList(process.env.ADMIN_ALLOWED_ORIGINS) }
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
