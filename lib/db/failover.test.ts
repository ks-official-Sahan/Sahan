import assert from "node:assert/strict";
import { test } from "node:test";

import { readFailoverEnabled, readSources, runOnSources, SourceBreaker } from "./failover";

const A = "postgresql://u:p@ep-a-pooler.neon.tech/db?schema=sahan";
const A_DIRECT = "postgresql://u:p@ep-a.neon.tech/db";
const A_REPLICA = "postgresql://u:p@ep-r-pooler.neon.tech/db";
const B = "postgresql://u:p@ep-b-pooler.neon.tech/db";
const B_REPLICA = "postgresql://u:p@ep-s-pooler.neon.tech/db";

test("readSources puts a distinct replica before the primary", () => {
  assert.deepEqual(readSources({}), []);
  assert.deepEqual(readSources({ DATABASE_URL: A }), ["primary"]);
  assert.deepEqual(readSources({ DATABASE_URL: A, DATABASE_READONLY_REPLICA_URL: A_REPLICA }), ["replica", "primary"]);
});

test("a replica URL that is the primary itself is ignored", () => {
  assert.deepEqual(readSources({ DATABASE_URL: A, DATABASE_READONLY_REPLICA_URL: A }), ["primary"]);
  assert.deepEqual(readSources({ DATABASE_URL: A, DATABASE_READONLY_REPLICA_URL: A_DIRECT }), ["primary"]);
});

test("the backup serves reads only with DB_FAILOVER=read-only and a distinct host", () => {
  const env = { DATABASE_URL: A, BACKUP_DATABASE_URL: B, BACKUP_DATABASE_READONLY_REPLICA_URL: B_REPLICA };
  assert.equal(readFailoverEnabled(env), false);
  assert.deepEqual(readSources(env), ["primary"]);
  assert.deepEqual(readSources({ ...env, DB_FAILOVER: "read-only" }), ["primary", "backupReplica"]);
  assert.deepEqual(readSources({ DATABASE_URL: A, BACKUP_DATABASE_URL: B, DB_FAILOVER: "read-only" }), ["primary", "backup"]);
  assert.deepEqual(readSources({ DATABASE_URL: A, BACKUP_DATABASE_URL: A_DIRECT, DB_FAILOVER: "read-only" }), ["primary"]);
});

test("SourceBreaker skips a tripped source for the cooldown", () => {
  let now = 0;
  const breaker = new SourceBreaker({ now: () => now, cooldownMs: 1_000 });
  assert.equal(breaker.trip("replica"), true);
  assert.equal(breaker.trip("replica"), false);
  assert.deepEqual(breaker.order(["replica", "primary"]), ["primary"]);
  now = 1_000;
  assert.deepEqual(breaker.order(["replica", "primary"]), ["replica", "primary"]);
});

test("SourceBreaker tries every source when all are tripped", () => {
  const breaker = new SourceBreaker({ now: () => 0 });
  breaker.trip("replica");
  breaker.trip("primary");
  assert.deepEqual(breaker.order(["replica", "primary"]), ["replica", "primary"]);
});

test("runOnSources moves on after a connection failure and rethrows any other error", async () => {
  const breaker = new SourceBreaker({ now: () => 0 });
  const tripped: string[] = [];
  const result = await runOnSources(
    ["replica", "primary"],
    breaker,
    async (source) => {
      if (source === "replica") throw Object.assign(new Error("down"), { code: "P1001" });
      return source;
    },
    (source) => tripped.push(source)
  );
  assert.equal(result, "primary");
  assert.deepEqual(tripped, ["replica"]);

  await assert.rejects(
    runOnSources(["primary"], new SourceBreaker(), async () => {
      throw Object.assign(new Error("unique"), { code: "P2002" });
    }),
    /unique/
  );
});
