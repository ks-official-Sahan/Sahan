import assert from "node:assert/strict";
import { test } from "node:test";

import { readStepUp, signStepUp } from "./step-up";

const SECRET = "test-secret-at-least-32-characters-long";
const step = { challengeId: "8b5f7d1e-2c4a-4f2b-9e1a-0c3d5e7f9a1b", action: "mask:self:on" };

test("a ticket reads back as the challenge and action it was signed for", () => {
  assert.deepEqual(readStepUp(SECRET, "user-1", signStepUp(SECRET, "user-1", step)), step);
});

test("a ticket is refused for another user, another secret, or a changed action", () => {
  const ticket = signStepUp(SECRET, "user-1", step);
  assert.equal(readStepUp(SECRET, "user-2", ticket), null);
  assert.equal(readStepUp("another-secret-at-least-32-characters", "user-1", ticket), null);
  const [id, , signature] = ticket.split(".");
  const swapped = [id, Buffer.from("mask:global:on").toString("base64url"), signature].join(".");
  assert.equal(readStepUp(SECRET, "user-1", swapped), null);
});

test("malformed tickets are refused", () => {
  for (const ticket of [undefined, null, 42, "", "a.b", "a.b.c.d", "..", "x".repeat(2000)]) {
    assert.equal(readStepUp(SECRET, "user-1", ticket), null, String(ticket));
  }
});
