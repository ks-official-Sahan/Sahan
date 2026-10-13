// Pure helpers for the page-view beacon: they turn request data into the
// small, bounded labels the analytics store counts. Nothing here keeps or
// returns a raw IP address or user agent.

export type Device = "desktop" | "mobile" | "tablet";

/** Days of analytics kept in Redis. */
export const RETENTION_DAYS = 90;
/** Date ranges the dashboard offers. */
export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

const BOT =
  /bot\b|bot\/|crawl|spider|slurp|scrape|facebookexternalhit|embedly|preview|headless|lighthouse|pagespeed|pingdom|uptime|monitor|curl\/|wget|python|axios|node-fetch|undici|go-http|java\/|okhttp|httpclient|postman|insomnia/i;

/** True for crawlers, monitors, headless browsers and HTTP libraries. */
export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || userAgent.length < 10 || BOT.test(userAgent);
}

export function deviceOf(userAgent: string): Device {
  if (/ipad|tablet|playbook|silk|kindle|android(?!.*mobi)/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) return "mobile";
  return "desktop";
}

// Order matters: Edge, Opera and Samsung Internet also say "Chrome", and
// Chrome also says "Safari".
const BROWSERS: [RegExp, string][] = [
  [/edg(e|a|ios)?\//i, "Edge"],
  [/opr\/|opera/i, "Opera"],
  [/samsungbrowser/i, "Samsung Internet"],
  [/firefox|fxios/i, "Firefox"],
  [/chrome|crios|chromium/i, "Chrome"],
  [/safari/i, "Safari"],
];

export function browserOf(userAgent: string): string {
  return BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? "Other";
}

const SYSTEMS: [RegExp, string][] = [
  [/iphone|ipad|ipod/i, "iOS"],
  [/android/i, "Android"],
  [/cros/i, "ChromeOS"],
  [/windows/i, "Windows"],
  [/mac os x|macintosh/i, "macOS"],
  [/linux/i, "Linux"],
];

export function osOf(userAgent: string): string {
  return SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? "Other";
}

const MAX_PATH = 200;
const SAFE_PATH = /^\/[A-Za-z0-9\-._~%/]*$/;

/**
 * A public page path as the store keeps it: no query or hash, no trailing
 * slash, at most 200 characters. Null for anything that is not a public page
 * path (admin, API, files, or unexpected characters), so a caller cannot
 * fill the store with arbitrary strings.
 */
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return null;
  let path = raw.split(/[?#]/, 1)[0] ?? "";
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (path.length === 0 || path.length > MAX_PATH || !SAFE_PATH.test(path)) return null;
  if (/^\/(admin|api|_next)(\/|$)/.test(path) || path.includes("..")) return null;
  return path;
}

/**
 * The host of an external referrer, without "www.". Null for a missing or
 * malformed referrer, or one from this site (internal navigation).
 */
export function referrerHost(raw: unknown, ownHosts: readonly (string | null | undefined)[]): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return null;
  let host: string;
  try {
    const url = new URL(raw);
    if (!/^(https?|android-app):$/.test(url.protocol)) return null;
    host = url.hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "");
  if (!host || host.length > 100) return null;
  const own = ownHosts.filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, ""));
  return own.includes(host) ? null : host;
}

/** ISO country code from the hosting platform's geo header, or "XX" when unknown (or Tor, "T1"). */
export function countryOf(headers: { get(name: string): string | null }): string {
  const code = (headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry") ?? "").toUpperCase();
  return /^[A-Z]{2}$/.test(code) && code !== "T1" ? code : "XX";
}

/** True when the browser asks not to be tracked (Do Not Track or Global Privacy Control). */
export function optedOut(headers: { get(name: string): string | null }): boolean {
  return headers.get("dnt") === "1" || headers.get("sec-gpc") === "1";
}

/** YYYY-MM-DD in UTC, `offset` days before `now`. */
export function utcDay(now: number, offset = 0): string {
  return new Date(now - offset * 86_400_000).toISOString().slice(0, 10);
}

/** The last `count` UTC days, oldest first, ending `skip` days before today. */
export function lastDays(now: number, count: number, skip = 0): string[] {
  return Array.from({ length: count }, (_, index) => utcDay(now, skip + count - 1 - index));
}

export function parseRange(raw: unknown): AnalyticsRange {
  const value = Number.parseInt(String(raw ?? "").replace(/d$/, ""), 10);
  return (ANALYTICS_RANGES as readonly number[]).includes(value) ? (value as AnalyticsRange) : 30;
}
