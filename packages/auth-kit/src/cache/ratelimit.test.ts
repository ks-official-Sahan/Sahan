import assert from "node:assert/strict";
import { test } from "node:test";

import { LIMITS, MemoryLimiter, limit, type LimitBackend, type LimitName } from "./ratelimit";

function limiterWithClock() {
  let now = 1_000_000;
  return { limiter: new MemoryLimiter(() => now), advance: (seconds: number) => (now += seconds * 1000) };
}

test("the memory limiter allows up to max, then denies", async () => {
  const { limiter } = limiterWithClock();
  const rule = LIMITS["login:ip"]; // 10 per 10 minutes
  for (let i = 0; i < rule.max; i += 1) {
    const result = await limiter.check("login:ip", "1.2.3.4", rule);
    assert.equal(result.ok, true);
    assert.equal(result.remaining, rule.max - i - 1);
  }
  const denied = await limiter.check("login:ip", "1.2.3.4", rule);
  assert.equal(denied.ok, false);
  assert.equal(denied.remaining, 0);
  assert.ok(denied.resetSeconds >= 1 && denied.resetSeconds <= rule.windowSeconds);
});

test("the window slides: a slot frees when the oldest hit ages out", async () => {
  const { limiter, advance } = limiterWithClock();
  const rule = LIMITS["mfa:send:user"]; // 3 per 10 minutes
  for (let i = 0; i < rule.max; i += 1) await limiter.check("mfa:send:user", "u1", rule);
  assert.equal((await limiter.check("mfa:send:user", "u1", rule)).ok, false);

  advance(rule.windowSeconds + 1);
  assert.equal((await limiter.check("mfa:send:user", "u1", rule)).ok, true);
});

test("identifiers and limit names are independent", async () => {
  const { limiter } = limiterWithClock();
  const rule = LIMITS["login:acct"]; // 5 failures
  for (let i = 0; i < rule.max; i += 1) await limiter.check("login:acct", "a@x.com", rule);
  assert.equal((await limiter.check("login:acct", "a@x.com", rule)).ok, false);
  assert.equal((await limiter.check("login:acct", "b@x.com", rule)).ok, true);
  assert.equal((await limiter.check("login:ip", "a@x.com", LIMITS["login:ip"])).ok, true);
});

test("limit() uses the backend result when it works", async () => {
  const backend: LimitBackend = {
    async check() {
      return { ok: true, remaining: 7, resetSeconds: 60, degraded: false };
    },
  };
  assert.deepEqual(await limit("chat:ip", "x", { backend }), {
    ok: true,
    remaining: 7,
    resetSeconds: 60,
    degraded: false,
  });
});

test("a failing backend follows each rule's fail mode", async () => {
  const broken: LimitBackend = {
    async check() {
      throw new Error("redis down");
    },
  };

  const closed = await limit("unlock:ip", "x", { backend: broken });
  assert.equal(closed.ok, false);
  assert.equal(closed.degraded, true);

  const open = await limit("contact:ip", "x", { backend: broken });
  assert.equal(open.ok, true);
  assert.equal(open.degraded, true);
});

test("a hung backend times out and follows the fail mode", async () => {
  const hung: LimitBackend = { check: () => new Promise(() => undefined) };
  const closed = await limit("login:ip", "x", { backend: hung, timeoutMs: 20 });
  assert.equal(closed.ok, false);
  assert.equal(closed.degraded, true);
  const open = await limit("contact:global", "x", { backend: hung, timeoutMs: 20 });
  assert.equal(open.ok, true);
});

test("only the public contact limits fail open", () => {
  const open = (Object.keys(LIMITS) as LimitName[]).filter((name) => LIMITS[name].failMode === "open");
  assert.deepEqual(open.sort(), ["contact:global", "contact:ip"]);
});

test("the limits match the design table", () => {
  assert.deepEqual(LIMITS["unlock:ip"], { windowSeconds: 600, max: 10, failMode: "closed" });
  assert.deepEqual(LIMITS["login:acct"], { windowSeconds: 900, max: 5, failMode: "closed" });
  assert.deepEqual(LIMITS["contact:ip"], { windowSeconds: 3600, max: 5, failMode: "open" });
  assert.deepEqual(LIMITS["chat:session"], { windowSeconds: 60, max: 6, failMode: "closed" });
});
