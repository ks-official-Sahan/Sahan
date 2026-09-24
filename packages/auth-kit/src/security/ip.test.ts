import assert from "node:assert/strict";
import { test } from "node:test";

import { UNKNOWN_IP, clientIp } from "./ip";

const reader = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
});

const vercelEnv = { VERCEL: "1" };

test("on Vercel the platform header wins over the forwarded list", () => {
  assert.equal(
    clientIp(reader({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "198.51.100.1" }), {}, vercelEnv),
    "203.0.113.9"
  );
});

test("on Vercel x-real-ip comes next, then the first forwarded entry", () => {
  assert.equal(clientIp(reader({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "198.51.100.1" }), {}, vercelEnv), "203.0.113.5");
  assert.equal(clientIp(reader({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }), {}, vercelEnv), "198.51.100.1");
});

test("off Vercel and without a trusted proxy no header is believed", () => {
  const forged = reader({
    "x-vercel-forwarded-for": "1.2.3.4",
    "x-real-ip": "5.6.7.8",
    "x-forwarded-for": "9.9.9.9, 198.51.100.7",
  });
  assert.equal(clientIp(forged, {}, {}), UNKNOWN_IP);
  assert.equal(clientIp(forged, {}, { TRUSTED_PROXY_HOPS: "0" }), UNKNOWN_IP);
  assert.equal(clientIp(forged, {}, { TRUSTED_PROXY_HOPS: "many" }), UNKNOWN_IP);
});

test("TRUSTED_PROXY_HOPS picks the entry that many places from the right", () => {
  const headers = reader({ "x-forwarded-for": "1.2.3.4, 198.51.100.7, 10.0.0.2" });
  assert.equal(clientIp(headers, {}, { TRUSTED_PROXY_HOPS: "1" }), "10.0.0.2");
  assert.equal(clientIp(headers, {}, { TRUSTED_PROXY_HOPS: "2" }), "198.51.100.7");
  assert.equal(clientIp(headers, {}, { TRUSTED_PROXY_HOPS: "9" }), UNKNOWN_IP, "more hops than entries");
  assert.equal(clientIp(reader({}), {}, { TRUSTED_PROXY_HOPS: "1" }), UNKNOWN_IP, "no header");
});

test("IPv6 is accepted and lower-cased", () => {
  assert.equal(clientIp(reader({ "x-real-ip": "2001:DB8::1" }), {}, vercelEnv), "2001:db8::1");
  assert.equal(clientIp(reader({ "x-forwarded-for": "2001:DB8::1" }), {}, { TRUSTED_PROXY_HOPS: "1" }), "2001:db8::1");
});

test("junk gives unknown", () => {
  assert.equal(clientIp(reader({ "x-real-ip": "<script>", "x-forwarded-for": "198.51.100.7" }), {}, vercelEnv), "198.51.100.7");
  assert.equal(clientIp(reader({ "x-real-ip": "not an ip" }), {}, vercelEnv), UNKNOWN_IP);
  assert.equal(clientIp(reader({ "x-forwarded-for": "<script>" }), {}, { TRUSTED_PROXY_HOPS: "1" }), UNKNOWN_IP);
  assert.equal(clientIp(reader({}), {}, {}), UNKNOWN_IP);
});

test("explicit options override the environment", () => {
  const headers = reader({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "1.2.3.4, 198.51.100.7, 10.0.0.2" });
  // No VERCEL env, but trustVercel is forced on.
  assert.equal(clientIp(headers, { trustVercel: true }, {}), "203.0.113.9");
  // VERCEL env set, but trustVercel is forced off in favor of an explicit hop count.
  assert.equal(clientIp(headers, { trustVercel: false, hops: 1 }, vercelEnv), "10.0.0.2");
});
