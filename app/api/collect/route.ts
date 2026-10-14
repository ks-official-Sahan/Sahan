import { after } from "next/server";

import { createCollectHandler } from "@sahan-sac/analytics-kit/collect";

import { analytics } from "@/lib/analytics/store";
import { limit } from "@/lib/cache/ratelimit";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { clientIp } from "@/lib/security/ip";

// The page-view beacon (components/site/analytics/PageViewBeacon.tsx).
// proxy.ts already rejects cross-origin POSTs to /api/*; the handler answers
// 204 at once and records the view in after(), keyed by the daily visitor
// hash for the rate limit (never the raw IP).

function hostOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
}

const collect = createCollectHandler({
  store: analytics,
  clientIp: (request) => clientIp(request.headers),
  siteHosts: [hostOf(process.env.SITE_URL)],
  allow: async (visitor) => (await limit("collect:visitor", visitor)).ok,
  defer: (task) => after(task),
  log,
});

export async function POST(request: Request) {
  // Read once here so a misconfigured env fails the route, not the deferred write.
  getEnv();
  return collect(request);
}
