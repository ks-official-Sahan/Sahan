import assert from "node:assert/strict";
import { test } from "node:test";

import {
  browserOf,
  countryOf,
  deviceOf,
  isBot,
  lastDays,
  normalizePath,
  optedOut,
  osOf,
  parseRange,
  referrerHost,
} from "./classify";
import { summarize } from "./store";

const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name.toLowerCase()] ?? null });

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const EDGE_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0";
const ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 14; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const ANDROID_PHONE = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";

test("bots, monitors, HTTP libraries and empty agents are not counted", () => {
  for (const agent of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0 Safari/537.36",
    "curl/8.5.0",
    "python-requests/2.32",
    "facebookexternalhit/1.1",
    "",
    null,
  ]) {
    assert.equal(isBot(agent), true, String(agent));
  }
  assert.equal(isBot(CHROME_WIN), false);
  assert.equal(isBot(SAFARI_IPHONE), false);
});

test("device, browser and system come from the user agent", () => {
  assert.deepEqual([deviceOf(CHROME_WIN), browserOf(CHROME_WIN), osOf(CHROME_WIN)], ["desktop", "Chrome", "Windows"]);
  assert.deepEqual([deviceOf(SAFARI_IPHONE), browserOf(SAFARI_IPHONE), osOf(SAFARI_IPHONE)], ["mobile", "Safari", "iOS"]);
  assert.deepEqual([deviceOf(EDGE_MAC), browserOf(EDGE_MAC), osOf(EDGE_MAC)], ["desktop", "Edge", "macOS"]);
  assert.equal(deviceOf(ANDROID_TABLET), "tablet");
  assert.equal(deviceOf(ANDROID_PHONE), "mobile");
  assert.equal(osOf(ANDROID_PHONE), "Android");
});

test("only public page paths are kept, without query, hash or trailing slash", () => {
  assert.equal(normalizePath("/"), "/");
  assert.equal(normalizePath("/works/"), "/works");
  assert.equal(normalizePath("/updates/my-post?utm_source=x#top"), "/updates/my-post");
  for (const bad of ["/admin", "/admin/users", "/api/collect", "/_next/static/x.js", "//evil.com", "https://x.com/", "/a b", "/<script>", "/../etc", 42, null, `/${"a".repeat(201)}`]) {
    assert.equal(normalizePath(bad), null, String(bad));
  }
});

test("referrers keep the external host only", () => {
  const own = ["sahan.dev", "localhost:3000"];
  assert.equal(referrerHost("https://www.google.com/search?q=sahan", own), "google.com");
  assert.equal(referrerHost("https://sahan.dev/works", own), null);
  assert.equal(referrerHost("https://www.sahan.dev/", own), null);
  assert.equal(referrerHost("http://localhost:3000/about", own), null);
  assert.equal(referrerHost("android-app://com.linkedin.android/", own), "com.linkedin.android");
  assert.equal(referrerHost("javascript:alert(1)", own), null);
  assert.equal(referrerHost("not a url", own), null);
  assert.equal(referrerHost("", own), null);
});

test("country comes from the platform header, unknown and Tor read as XX", () => {
  assert.equal(countryOf(headers({ "x-vercel-ip-country": "lk" })), "LK");
  assert.equal(countryOf(headers({ "cf-ipcountry": "DE" })), "DE");
  assert.equal(countryOf(headers({ "cf-ipcountry": "T1" })), "XX");
  assert.equal(countryOf(headers({ "x-vercel-ip-country": "<x>" })), "XX");
  assert.equal(countryOf(headers({})), "XX");
});

test("Do Not Track and Global Privacy Control opt out", () => {
  assert.equal(optedOut(headers({ dnt: "1" })), true);
  assert.equal(optedOut(headers({ "sec-gpc": "1" })), true);
  assert.equal(optedOut(headers({ dnt: "0" })), false);
});

test("ranges and day lists", () => {
  assert.equal(parseRange("7"), 7);
  assert.equal(parseRange("90d"), 90);
  assert.equal(parseRange("365"), 30);
  assert.equal(parseRange(undefined), 30);
  const now = Date.UTC(2026, 9, 11, 12);
  assert.deepEqual(lastDays(now, 3), ["2026-10-09", "2026-10-10", "2026-10-11"]);
  assert.deepEqual(lastDays(now, 2, 2), ["2026-10-08", "2026-10-09"]);
});

test("summarize turns pipeline replies into totals and ranked lists", () => {
  const summary = summarize({
    range: 7,
    days: ["2026-10-10", "2026-10-11"],
    hashes: [
      { pv: 3, "d:desktop": 2, "d:mobile": 1, "b:Chrome": 3, "o:Windows": 3, "c:LK": 2, "c:US": 1 },
      { pv: "2", "d:mobile": 2, "b:Safari": 2, "o:iOS": 2, "c:US": 2 },
    ],
    dailyVisitors: [2, 1],
    visitors: 3,
    previousViews: [1, null, "4"],
    previousVisitors: 2,
    live: 1,
    pages: ["/", "4", "/works", 1],
    referrers: [],
    generatedAt: "2026-10-11T12:00:00.000Z",
  });
  assert.deepEqual(summary.days, [
    { day: "2026-10-10", views: 3, visitors: 2 },
    { day: "2026-10-11", views: 2, visitors: 1 },
  ]);
  assert.deepEqual(summary.totals, { views: 5, visitors: 3, previousViews: 5, previousVisitors: 2 });
  assert.equal(summary.live, 1);
  assert.deepEqual(summary.pages, [
    { label: "/", value: 4 },
    { label: "/works", value: 1 },
  ]);
  assert.deepEqual(summary.countries, [
    { label: "US", value: 3 },
    { label: "LK", value: 2 },
  ]);
  assert.deepEqual(summary.devices, [
    { label: "mobile", value: 3 },
    { label: "desktop", value: 2 },
  ]);
  assert.deepEqual(summary.referrers, []);
});
