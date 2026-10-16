import assert from "node:assert/strict";
import { test } from "node:test";

import { cursorOf, logHref, parseLogQuery } from "./log-query";

test("parseLogQuery keeps known values and drops the rest", () => {
  assert.deepEqual(parseLogQuery({ status: "bounced", category: "invite" }), { status: "bounced", category: "invite" });
  assert.deepEqual(parseLogQuery({ status: "bogus value", category: ["nope"], before: "x" }), {});
});

test("the cursor round-trips through the URL", () => {
  const row = { createdAt: new Date("2026-10-16T12:00:00Z"), id: "ckabc123" };
  const query = parseLogQuery({ before: cursorOf(row) });
  assert.deepEqual(query.before, row);
  assert.equal(logHref({ status: "sent" }, cursorOf(row)), `/admin/emails?status=sent&before=${cursorOf(row)}`);
  assert.equal(logHref({}), "/admin/emails");
});
