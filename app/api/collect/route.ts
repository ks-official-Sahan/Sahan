import { after, type NextRequest } from "next/server";

import {
  browserOf,
  countryOf,
  deviceOf,
  isBot,
  normalizePath,
  optedOut,
  osOf,
  referrerHost,
} from "@/lib/analytics/classify";
import { recordPageView, visitorId } from "@/lib/analytics/store";
import { limit } from "@/lib/cache/ratelimit";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { clientIp } from "@/lib/security/ip";
import { readBodyText } from "@/lib/security/read-body";

// The page-view beacon (components/site/analytics/PageViewBeacon.tsx).
// proxy.ts already rejects cross-origin POSTs to /api/*. The answer is always
// 204 and the write runs after it, so a slow or missing Redis never slows a
// page, and a caller learns nothing from the response.

const NO_CONTENT = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

function hostOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const headers = request.headers;
  const userAgent = headers.get("user-agent");
  if (!headers.get("content-type")?.includes("application/json") || isBot(userAgent) || optedOut(headers)) return NO_CONTENT();

  const text = await readBodyText(request, 1024);
  if (!text) return NO_CONTENT();
  let body: { p?: unknown; r?: unknown };
  try {
    body = JSON.parse(text) as { p?: unknown; r?: unknown };
  } catch {
    return NO_CONTENT();
  }
  const path = normalizePath(body.p);
  if (!path || !userAgent) return NO_CONTENT();

  const referrer = referrerHost(body.r, [headers.get("host"), hostOf(getEnv().SITE_URL)]);
  const country = countryOf(headers);
  const ip = clientIp(headers);

  after(async () => {
    try {
      const visitor = await visitorId(ip, userAgent);
      if (!visitor) return;
      const allowed = await limit("collect:visitor", visitor);
      if (!allowed.ok) return;
      await recordPageView({ visitor, path, referrer, device: deviceOf(userAgent), browser: browserOf(userAgent), os: osOf(userAgent), country });
    } catch (error) {
      log.warn("analytics beacon dropped", { error: String(error) });
    }
  });
  return NO_CONTENT();
}
