// Browser side: one page view per route change. No cookie, no storage, no
// third party and no framework: call trackPageView from your router's
// navigation hook (React, Vue, Svelte, or a plain history listener).

/** False when the browser asks not to be tracked (Do Not Track, Global Privacy Control) or runs under automation. */
export function trackingAllowed(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return !nav.webdriver && nav.doNotTrack !== "1" && nav.globalPrivacyControl !== true;
}

let lastPath: string | null = null;
let sentFirst = false;

export interface TrackOptions {
  /** The collect endpoint. Default "/api/collect". */
  endpoint?: string;
}

/**
 * Sends one view for `path` unless it repeats the last one. The external
 * referrer goes with the first view only: client-side navigations keep the
 * landing page's document.referrer. Never throws.
 */
export function trackPageView(path: string, options: TrackOptions = {}): void {
  if (!path || path === lastPath || !trackingAllowed()) return;
  lastPath = path;
  const body = JSON.stringify({ p: path, r: sentFirst ? undefined : document.referrer });
  sentFirst = true;
  fetch(options.endpoint ?? "/api/collect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
    credentials: "omit",
  }).catch(() => {});
}
