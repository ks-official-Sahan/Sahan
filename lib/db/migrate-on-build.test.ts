import assert from "node:assert/strict";
import { test } from "node:test";

import { decide, directUrl, isLockTimeout, isUnreachable, sameEndpoint, targets } from "../../scripts/migrate-on-build.mjs";

test("migrates Vercel production builds only, unless the flag says otherwise", () => {
  assert.equal(decide({ VERCEL: "1", VERCEL_ENV: "production" }).run, true);
  assert.equal(decide({ VERCEL: "1", VERCEL_ENV: "preview" }).run, false);
  assert.equal(decide({}).run, false);
  assert.equal(decide({ MIGRATE_ON_BUILD: "true" }).run, true);
  assert.equal(decide({ MIGRATE_ON_BUILD: " On " }).run, true);
  assert.equal(decide({ MIGRATE_ON_BUILD: "false", VERCEL: "1", VERCEL_ENV: "production" }).run, false);
  assert.equal(decide({ MIGRATE_ON_BUILD: "maybe" }).run, false);
});

test("directUrl leaves the pooler and drops channel_binding", () => {
  const url = directUrl("postgresql://u:p@ep-x-pooler.us-east-1.aws.neon.tech/db?sslmode=require&channel_binding=require&schema=sahan");
  assert.equal(url, "postgresql://u:p@ep-x.us-east-1.aws.neon.tech/db?sslmode=require&schema=sahan");
});

test("targets: primary first, backup only when set, direct URLs win", () => {
  assert.deepEqual(targets({}), []);
  const both = targets({
    DATABASE_URL: "postgresql://u:p@ep-a-pooler.r.neon.tech/db",
    BACKUP_DATABASE_URL: "postgresql://u:p@ep-b-pooler.r.neon.tech/db",
  });
  assert.deepEqual(
    both.map((t: { name: string; url: string }) => [t.name, new URL(t.url).hostname]),
    [
      ["primary", "ep-a.r.neon.tech"],
      ["backup", "ep-b.r.neon.tech"],
    ]
  );
  const direct = targets({ DATABASE_URL: "postgresql://u:p@ep-a-pooler.r.neon.tech/db", DIRECT_DATABASE_URL: "postgresql://u:p@other/db" });
  assert.equal(direct[0].url, "postgresql://u:p@other/db");
  assert.deepEqual(targets({ DIRECT_DATABASE_URL: "postgresql://u:p@other/db", BACKUP_DIRECT_DATABASE_URL: "postgresql://u:p@b/db" }), []);
});

test("isLockTimeout spots Prisma's advisory lock failure", () => {
  assert.equal(isLockTimeout("Error: P1002 Timed out trying to acquire a postgres advisory lock"), true);
  assert.equal(isLockTimeout("P3009 migrate found failed migrations"), false);
});

test("isUnreachable spots Prisma's can't-reach-server failure", () => {
  assert.equal(isUnreachable("Error: P1001: Can't reach database server at `ep-x.neon.tech:5432`"), true);
  assert.equal(isUnreachable("Error: P1002 Timed out trying to acquire a postgres advisory lock"), false);
  assert.equal(isUnreachable("P3009 migrate found failed migrations"), false);
});

test("isUnreachable retries a refused connection but not an exhausted quota", () => {
  assert.equal(isUnreachable("Error: connect ECONNREFUSED 10.0.0.1:5432"), true);
  // A quota does not come back within the retry window, so it fails at once.
  assert.equal(isUnreachable("Database error. Code: `53000`. Message: `Your account or project has exceeded the quota.`"), false);
});

test("sameEndpoint ignores pooler suffix", () => {
  assert.equal(
    sameEndpoint(
      "postgresql://u:p@ep-x-pooler.us-east-1.aws.neon.tech/lakeview",
      "postgresql://u:p@ep-x.us-east-1.aws.neon.tech/lakeview"
    ),
    true
  );
  assert.equal(
    sameEndpoint(
      "postgresql://u:p@ep-a.us-east-1.aws.neon.tech/lakeview",
      "postgresql://u:p@ep-b.us-east-1.aws.neon.tech/lakeview"
    ),
    false
  );
});
