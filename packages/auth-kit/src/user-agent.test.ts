import assert from "node:assert/strict";
import { test } from "node:test";

import { userAgent } from "next/server";

import { parseUserAgent } from "./user-agent";

const AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "curl/8.7.1",
];

test("parseUserAgent reads browser, OS and device exactly as next/server's userAgent()", () => {
  for (const ua of AGENTS) {
    const next = userAgent({ headers: new Headers({ "user-agent": ua }) });
    assert.deepEqual(
      parseUserAgent(ua),
      { browser: next.browser.name ?? null, os: next.os.name ?? null, deviceType: next.device.type ?? null },
      ua
    );
  }
});

test("parseUserAgent without a user agent is all null", () => {
  assert.deepEqual(parseUserAgent(null), { browser: null, os: null, deviceType: null });
  assert.deepEqual(parseUserAgent(""), { browser: null, os: null, deviceType: null });
});
