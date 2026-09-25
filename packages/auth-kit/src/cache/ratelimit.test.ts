import assert from "node:assert/strict";
import { test } from "node:test";

import { MemoryLimiter, createRateLimit, type LimitBackend, type LimitRule } from "./ratelimit";

// A small bucket catalogue standing in for an app's own (the package ships no
// bucket names of its own; see kit.ts / defineAuthKit for where an app's real
// catalogue lives).
const RULES = {
  "login:ip": { windowSeconds: 600, max: 10, failMode: "closed" },
  "login:acct": { windowSeconds: 900, max: 5, failMode: "closed" },
  "mfa:send:user": { windowSeconds: 600, max: 3, failMode: "closed" },
  "unlock:ip": { windowSeconds: 600, max: 10, failMode: "closed" },
  "contact:ip": { windowSeconds: 3600, max: 5, failMode: "open" },
  "contact:global": { windowSeconds: 3600, max: 100, failMode: "open" },
} as const satisfies Record<string, LimitRule>;
type RuleName = keyof typeof RULES;

function limiterWithClock() {
  let now = 1_000_000;
  return { limiter: new MemoryLimiter(() => now), advance: (seconds: number) => (now += seconds * 1000) };
}

test("the memory limiter allows up to max, then denies", async () => {
  const { limiter } = limiterWithClock();
  const rule = RULES["login:ip"]; // 10 per 10 minutes
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
  const rule = RULES["mfa:send:user"]; // 3 per 10 minutes
  for (let i = 0; i < rule.max; i += 1) await limiter.check("mfa:send:user", "u1", rule);
  assert.equal((await limiter.check("mfa:send:user", "u1", rule)).ok, false);

  advance(rule.windowSeconds + 1);
  assert.equal((await limiter.check("mfa:send:user", "u1", rule)).ok, true);
});

test("identifiers and limit names are independent", async () => {
  const { limiter } = limiterWithClock();
  const rule = RULES["login:acct"]; // 5 failures
  for (let i = 0; i < rule.max; i += 1) await limiter.check("login:acct", "a@x.com", rule);
  assert.equal((await limiter.check("login:acct", "a@x.com", rule)).ok, false);
  assert.equal((await limiter.check("login:acct", "b@x.com", rule)).ok, true);
  assert.equal((await limiter.check("login:ip", "a@x.com", RULES["login:ip"])).ok, true);
});

test("the memory limiter sweeps fully-aged-out keys once the map grows large", async () => {
  const { limiter, advance } = limiterWithClock();
  const rule: LimitRule = { windowSeconds: 1, max: 1000, failMode: "closed" };
  for (let i = 0; i < 5001; i += 1) await limiter.check("bucket", `id-${i}`, rule);
  assert.equal(limiter.size(), 5001);
  advance(2); // every hit is now outside the 1 s window
  await limiter.check("bucket", "id-trigger", rule); // crosses SWEEP_THRESHOLD and sweeps
  assert.ok(limiter.size() <= 2, `expected old entries to be swept, got ${limiter.size()}`);
});

test("an unknown bucket name fails with a named error", async () => {
  const { limit } = createRateLimit(RULES, { backend: new MemoryLimiter() });
  await assert.rejects(() => limit("nope:ip" as keyof typeof RULES, "a"), /Unknown rate-limit bucket "nope:ip"/);
});

test("createRateLimit uses the backend result when it works", async () => {
  const backend: LimitBackend = {
    async check() {
      return { ok: true, remaining: 7, resetSeconds: 60, degraded: false };
    },
  };
  const { limit } = createRateLimit(RULES, { backend });
  assert.deepEqual(await limit("contact:ip" as RuleName, "x"), {
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
  const { limit } = createRateLimit(RULES, { backend: broken });

  const closed = await limit("unlock:ip", "x");
  assert.equal(closed.ok, false);
  assert.equal(closed.degraded, true);

  const open = await limit("contact:ip", "x");
  assert.equal(open.ok, true);
  assert.equal(open.degraded, true);
});

test("a hung backend times out and follows the fail mode", async () => {
  const hung: LimitBackend = { check: () => new Promise(() => undefined) };
  const { limit } = createRateLimit(RULES, { backend: hung, timeoutMs: 20 });
  const closed = await limit("login:ip", "x");
  assert.equal(closed.ok, false);
  assert.equal(closed.degraded, true);
  const open = await limit("contact:global", "x");
  assert.equal(open.ok, true);
});

test("a per-call backend and timeout override the limiter's defaults", async () => {
  const { limit } = createRateLimit(RULES); // in-memory default
  const backend: LimitBackend = {
    async check() {
      return { ok: false, remaining: 0, resetSeconds: 5, degraded: false };
    },
  };
  assert.deepEqual(await limit("login:ip", "x", { backend }), {
    ok: false,
    remaining: 0,
    resetSeconds: 5,
    degraded: false,
  });
});
