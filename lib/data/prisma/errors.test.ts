import assert from "node:assert/strict";
import { test } from "node:test";

import { isDbUnavailable } from "./errors";

test("isDbUnavailable spots connection failures, including plain-object driver errors", () => {
  assert.equal(isDbUnavailable({ code: "P1001" }), true);
  assert.equal(isDbUnavailable(new Error("read ECONNRESET")), true);
  assert.equal(isDbUnavailable({ name: "DriverAdapterError", cause: { kind: "postgres", message: "read ECONNRESET" } }), true);
  assert.equal(isDbUnavailable(new Error("Your account or project has exceeded the compute time quota.")), true);
});

test("isDbUnavailable leaves query errors alone", () => {
  assert.equal(isDbUnavailable({ code: "P2002" }), false);
  assert.equal(isDbUnavailable(new Error("Unique constraint failed")), false);
  assert.equal(isDbUnavailable(null), false);
});
