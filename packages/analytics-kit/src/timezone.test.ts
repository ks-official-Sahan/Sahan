import assert from "node:assert/strict";
import { test } from "node:test";

import { dayIn, lastDays, utcDay, validTimeZone } from "./classify";

// 2026-10-13 20:00 UTC is already 2026-10-14 01:30 in Colombo (+05:30).
const evening = Date.UTC(2026, 9, 13, 20, 0, 0);

test("a day follows the given zone's calendar, and UTC stays the default", () => {
  assert.equal(dayIn(evening), "2026-10-13");
  assert.equal(dayIn(evening, 0, "UTC"), "2026-10-13");
  assert.equal(dayIn(evening, 0, "Asia/Colombo"), "2026-10-14");
  assert.equal(dayIn(evening, 1, "Asia/Colombo"), "2026-10-13");
  assert.equal(dayIn(evening, 0, "America/Los_Angeles"), "2026-10-13");
  assert.equal(dayIn(evening, 0), utcDay(evening));
});

test("calendar stepping survives daylight-saving changes and month ends", () => {
  // Europe/London leaves summer time on 2026-10-25: 25 hours that day.
  const afterChange = Date.UTC(2026, 9, 26, 12, 0, 0);
  assert.deepEqual(lastDays(afterChange, 3, 0, "Europe/London"), ["2026-10-24", "2026-10-25", "2026-10-26"]);
  assert.deepEqual(lastDays(Date.UTC(2026, 2, 1, 1, 0, 0), 2, 0, "Asia/Colombo"), ["2026-02-28", "2026-03-01"]);
});

test("unknown zones are reported so the store can fall back to UTC", () => {
  assert.equal(validTimeZone("Asia/Colombo"), true);
  assert.equal(validTimeZone("UTC"), true);
  assert.equal(validTimeZone("Mars/Olympus"), false);
});
