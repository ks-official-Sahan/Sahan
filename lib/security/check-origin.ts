import "server-only";

import { headers } from "next/headers";

import { env } from "@/lib/env";
import { isAllowedOrigin } from "./origin";

// Convenience wrapper for checking origin in route handlers
export function checkOrigin(headerList: Headers, request?: { headers: Headers }): boolean {
  const origin = headerList.get("origin");
  const host = headerList.get("host");
  const forwardedHost = headerList.get("x-forwarded-host");

  return isAllowedOrigin(origin, {
    hosts: [host, forwardedHost],
    siteUrl: env.SITE_URL,
    extraOrigins: env.ADMIN_ALLOWED_ORIGINS,
  });
}
