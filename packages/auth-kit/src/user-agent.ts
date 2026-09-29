import UAParser from "ua-parser-js";

// User-agent parsing without Next.js. Uses ua-parser-js 1.x (MIT), the same
// parser `next/server`'s `userAgent()` bundles, so a browser, OS and device
// read the same whichever framework the app runs on.

export interface ParsedUserAgent {
  browser: string | null;
  os: string | null;
  /** "mobile", "tablet", ... or null for a desktop browser (ua-parser-js leaves it unset). */
  deviceType: string | null;
}

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua) return { browser: null, os: null, deviceType: null };
  const result = new UAParser(ua).getResult();
  return {
    browser: result.browser.name ?? null,
    os: result.os.name ?? null,
    deviceType: result.device.type ?? null,
  };
}
