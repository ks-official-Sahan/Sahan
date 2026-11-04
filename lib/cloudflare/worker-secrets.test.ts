import assert from "node:assert/strict";
import { test } from "node:test";

import { documentedNames, secretNames } from "../../scripts/worker-secrets.mjs";

test("documentedNames reads set and commented-out variables", () => {
  const names = documentedNames("# comment\nDATABASE_URL=\n# REDIS_URL=x\n#   AUTH_SECRET=\nlower=1\n");
  assert.deepEqual([...names].sort(), ["AUTH_SECRET", "DATABASE_URL", "REDIS_URL"]);
});

test("secretNames keeps documented runtime variables that are set", () => {
  const documented = new Set(["DATABASE_URL", "AUTH_SECRET", "MIGRATE_ON_BUILD", "EMPTY", "UNSET"]);
  const env = { DATABASE_URL: "postgres://x", AUTH_SECRET: "s", MIGRATE_ON_BUILD: "true", EMPTY: "  ", OTHER: "x" };
  assert.deepEqual(secretNames(documented, env), ["AUTH_SECRET", "DATABASE_URL"]);
});
