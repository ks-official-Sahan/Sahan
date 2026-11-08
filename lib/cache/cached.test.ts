import assert from "node:assert/strict";
import { test } from "node:test";

import { purgeRedisTag, readThrough, retryUnavailable } from "./cached";
import { MemoryKv } from "./memory";
import { kv } from "./redis";

// No Upstash env in tests, so kv is the in-memory store.

test("each purge starts a new generation that never repeats a used one", async () => {
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) {
    await purgeRedisTag("blog:list");
    const generation = await kv.get<string>("tagversion:blog:list");
    assert.equal(typeof generation, "string");
    assert.equal(seen.has(generation as string), false);
    seen.add(generation as string);
  }
});

test("readThrough caches null results and reloads after a purge", async () => {
  const store = new MemoryKv();
  let loads = 0;
  const load = async () => {
    loads += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return null;
  };
  assert.equal(await readThrough(store, ["t", "missing"], ["blog:list"], 60, load), null);
  assert.equal(loads, 1);
  assert.equal(await readThrough(store, ["t", "missing"], ["blog:list"], 60, load), null);
  assert.equal(loads, 1, "a cached null is a hit, not a miss");

  await store.set("tagversion:blog:list", "next-generation");
  assert.equal(await readThrough(store, ["t", "missing"], ["blog:list"], 60, load), null);
  assert.equal(loads, 2, "a new generation invalidates the cached value");
});

test("readThrough loads directly when Redis fails, and never throws for it", async () => {
  const broken = new MemoryKv();
  broken.get = async () => {
    throw new Error("redis down");
  };
  assert.equal(await readThrough(broken, ["t", "x"], ["tag"], 60, async () => 42), 42);
});

test("retryUnavailable retries a dropped connection, not a query error", async () => {
  let calls = 0;
  const value = await retryUnavailable(
    async () => {
      calls += 1;
      if (calls < 3) throw new Error("read ECONNRESET");
      return "ok";
    },
    3,
    0
  );
  assert.equal(value, "ok");
  assert.equal(calls, 3);

  let queries = 0;
  await assert.rejects(
    retryUnavailable(
      async () => {
        queries += 1;
        throw Object.assign(new Error("unique"), { code: "P2002" });
      },
      3,
      0
    ),
    /unique/
  );
  assert.equal(queries, 1);
});
