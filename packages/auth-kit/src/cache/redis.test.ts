import assert from "node:assert/strict";
import { test } from "node:test";

import { redisConfigFromEnv, redisConfigured } from "./redis";

const valid = { UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "token" };

test("redisConfigFromEnv: uses Redis when both variables are valid and REDIS_ENABLED is unset", () => {
  assert.deepEqual(redisConfigFromEnv(valid), { url: valid.UPSTASH_REDIS_REST_URL, token: "token" });
  assert.equal(redisConfigured(valid), true);
});

test("redisConfigFromEnv: REDIS_ENABLED off wins over a valid config", () => {
  for (const off of ["false", "0", "no", "OFF"]) {
    assert.equal(redisConfigFromEnv({ ...valid, REDIS_ENABLED: off }), null);
  }
  assert.notEqual(redisConfigFromEnv({ ...valid, REDIS_ENABLED: "true" }), null);
});

test("redisConfigFromEnv: missing or invalid variables fall back to memory", () => {
  assert.equal(redisConfigFromEnv({}), null);
  assert.equal(redisConfigFromEnv({ ...valid, UPSTASH_REDIS_REST_TOKEN: " " }), null);
  assert.equal(redisConfigFromEnv({ ...valid, UPSTASH_REDIS_REST_URL: "not a url" }), null);
  assert.equal(redisConfigFromEnv({ ...valid, UPSTASH_REDIS_REST_URL: "http://example.upstash.io" }), null);
});
