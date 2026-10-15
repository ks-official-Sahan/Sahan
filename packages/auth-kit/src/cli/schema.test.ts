import assert from "node:assert/strict";
import { test } from "node:test";

import { targetSchema } from "./index";

test("targetSchema takes --schema first, then the URL's schema parameter", () => {
  const saved = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL = "postgresql://u:p@h/db?schema=from_url";
    assert.equal(targetSchema(["doctor", "--schema", "flagged"]), "flagged");
    assert.equal(targetSchema(["doctor"]), "from_url");
    delete process.env.DATABASE_URL;
    assert.equal(targetSchema(["doctor"]), null);
  } finally {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  }
});

test("targetSchema accepts a hyphenated schema (it is always double-quoted) and refuses anything that could break out", () => {
  assert.equal(targetSchema(["--schema", "admin-panel"]), "admin-panel");
  for (const bad of ['a"; DROP SCHEMA x; --', "1abc", "a b", "a.b", "a".repeat(64)]) {
    assert.throws(() => targetSchema(["--schema", bad]), /Not a schema name/);
  }
});
