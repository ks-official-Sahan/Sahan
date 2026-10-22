import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPropertyFinderCache, redisKv, staleWhileRevalidate, type CacheKv } from "./cache";

function memoryKv(): CacheKv & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async <T>(key: string) => (data.has(key) ? (data.get(key) as T) : null),
    set: async (key, value) => void data.set(key, value),
    del: async (key) => void data.delete(key),
    tryLock: async (key) => (data.has(key) ? false : (data.set(key, 1), true)),
  };
}

describe("redisKv", () => {
  it("is the env guard: no client, no cache", () => {
    assert.equal(redisKv(null), null);
  });
});

describe("createPropertyFinderCache", () => {
  it("passes straight through without a cache", async () => {
    let calls = 0;
    const cache = createPropertyFinderCache({ kv: null, loadAll: async () => (calls++, ["a"]), loadOne: async () => null });
    assert.equal(cache.enabled, false);
    await cache.allListings();
    await cache.allListings();
    assert.equal(calls, 2);
  });

  it("serves the second read from cache and reloads after invalidate", async () => {
    let calls = 0;
    const cache = createPropertyFinderCache({ kv: memoryKv(), loadAll: async () => (calls++, ["a"]), loadOne: async () => null });
    await cache.allListings();
    assert.deepEqual(await cache.allListings(), ["a"]);
    assert.equal(calls, 1);
    await cache.invalidate();
    await cache.allListings();
    assert.equal(calls, 2);
  });

  it("returns [] when the API fails and nothing is cached", async () => {
    const cache = createPropertyFinderCache({ kv: memoryKv(), loadAll: async () => Promise.reject(new Error("down")), loadOne: async () => null });
    assert.deepEqual(await cache.allListings(), []);
  });
});

describe("staleWhileRevalidate", () => {
  it("serves stale data at once and refreshes it in the background", async () => {
    const kv = memoryKv();
    let t = 0;
    let version = 1;
    const tasks: (() => Promise<void>)[] = [];
    const options = { freshSeconds: 10, ttlSeconds: 100, now: () => t, background: (task: () => Promise<void>) => void tasks.push(task) };
    assert.equal(await staleWhileRevalidate(kv, "k", async () => version, options), 1);
    version = 2;
    t = 11_000;
    assert.equal(await staleWhileRevalidate(kv, "k", async () => version, options), 1);
    await tasks[0]();
    assert.equal(await staleWhileRevalidate(kv, "k", async () => version, options), 2);
  });
});
