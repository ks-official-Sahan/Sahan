import assert from "node:assert/strict";
import { test } from "node:test";

import { checkPassword, PASSWORD_MAX_LENGTH } from "./password-policy";

test("a long mixed password passes", () => {
  assert.deepEqual(checkPassword("Correct-Horse-Battery-7"), { ok: true, problems: [] });
});

test("length limits", () => {
  assert.equal(checkPassword("Ab1!Ab1!Ab1").ok, false);
  assert.equal(checkPassword("Ab1!Ab1!Ab1!").ok, true);
  assert.equal(checkPassword(`Ab1!${"x".repeat(PASSWORD_MAX_LENGTH)}`).ok, false);
  assert.equal(checkPassword(`Ab1!${"x".repeat(PASSWORD_MAX_LENGTH - 4)}`).ok, true);
});

test("needs three of four character classes", () => {
  assert.equal(checkPassword("alllowercaseletters").ok, false);
  assert.equal(checkPassword("lowerandUPPERonly").ok, false);
  assert.equal(checkPassword("lower-and-symbols-only").ok, false);
  assert.equal(checkPassword("lowerANDdigits123").ok, true);
  assert.equal(checkPassword("lower-symbols-and-1").ok, true);
});

test("the email address and its local part are refused", () => {
  const context = { email: "Ks.Official.Sahan@example.com" };
  assert.equal(checkPassword("ks.official.sahan@example.com", context).ok, false);
  assert.equal(checkPassword("KS.OFFICIAL.SAHAN", context).ok, false);
  assert.equal(checkPassword("ks.official.sahan!!A1", context).ok, true);
});

test("common passwords are refused, also with decoration", () => {
  assert.equal(checkPassword("Passw0rd1234!").ok, true, "long decorated variants are left to length and class rules");
  assert.equal(checkPassword("password123").ok, false);
  assert.equal(checkPassword("1234567890").ok, false);
  const result = checkPassword("PASSWORD!!!!!!!!1");
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((problem) => problem.includes("too common")));
});

test("problems are plain sentences", () => {
  for (const problem of checkPassword("a").problems) {
    assert.match(problem, /^[A-Z].*\.$/);
  }
});
