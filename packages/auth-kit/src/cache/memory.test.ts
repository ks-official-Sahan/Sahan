import assert from "node:assert/strict";
import { test } from "node:test";

import { MemoryKv } from "./memory";

function kvWithClock() {
  let now = 1_000_000;
  const kv = new MemoryKv(() => now);
  return { kv, advance: (seconds: number) => (now += seconds * 1000) };
}

test("set and get round trip any JSON-like value", async () => {
  const { kv } = kvWithClock();
  await kv.set("a", { n: 1, list: [1, 2] });
  assert.deepEqual(await kv.get("a"), { n: 1, list: [1, 2] });
  assert.equal(await kv.get("missing"), null);
});

test("a value expires after its TTL", async () => {
  const { kv, advance } = kvWithClock();
  await kv.set("session", "state", { ttlSeconds: 30 });
  advance(29);
  assert.equal(await kv.get("session"), "state");
  advance(1);
  assert.equal(await kv.get("session"), null);
  assert.equal(kv.size(), 0);
});

test("nx does not overwrite a live key but does replace an expired one", async () => {
  const { kv, advance } = kvWithClock();
  assert.equal(await kv.set("gate", 1, { nx: true, ttlSeconds: 60 }), true);
  assert.equal(await kv.set("gate", 2, { nx: true, ttlSeconds: 60 }), false);
  assert.equal(await kv.get("gate"), 1);
  advance(61);
  assert.equal(await kv.set("gate", 3, { nx: true, ttlSeconds: 60 }), true);
  assert.equal(await kv.get("gate"), 3);
});

test("del counts only keys that existed", async () => {
  const { kv } = kvWithClock();
  await kv.set("a", 1);
  await kv.set("b", 2);
  assert.equal(await kv.del("a", "b", "c"), 2);
  assert.equal(await kv.get("a"), null);
});

test("incr counts up and the TTL is fixed when the counter is created", async () => {
  const { kv, advance } = kvWithClock();
  assert.equal(await kv.incr("hits", 10), 1);
  advance(5);
  assert.equal(await kv.incr("hits", 10), 2);
  advance(5);
  assert.equal(await kv.get("hits"), null, "the window ends 10 s after creation, not after the last hit");
  assert.equal(await kv.incr("hits", 10), 1);
});

test("expire updates the TTL of an existing key only", async () => {
  const { kv, advance } = kvWithClock();
  assert.equal(await kv.expire("nope", 5), false);
  await kv.set("k", "v");
  assert.equal(await kv.expire("k", 5), true);
  advance(6);
  assert.equal(await kv.get("k"), null);
});
