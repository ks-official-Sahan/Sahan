import assert from "node:assert/strict";
import { test } from "node:test";

import {
  challengeStatus,
  codeMatches,
  generateCode,
  hashCode,
  inheritedAttempts,
  MFA_MAX_ATTEMPTS,
  MFA_VERIFIED_WINDOW_SECONDS,
  newChallengeId,
  normalizeCode,
  verifiedWithinWindow,
} from "./rules";

const SECRET = "test-auth-secret-0123456789-abcdefghijklmnop";
const NOW = 1_800_000_000_000;
const row = (over = {}) => ({
  attempts: 0,
  expiresAt: new Date(NOW + 60_000),
  verifiedAt: null,
  consumedAt: null,
  ...over,
});

test("codes are six digits and vary", () => {
  const codes = new Set(Array.from({ length: 50 }, generateCode));
  for (const code of codes) assert.match(code, /^\d{6}$/);
  assert.ok(codes.size > 40);
});

test("input is normalised: spaces and dashes go, anything else is refused", () => {
  assert.equal(normalizeCode("123 456"), "123456");
  assert.equal(normalizeCode(" 123-456 "), "123456");
  for (const bad of ["12345", "1234567", "12345a", "", "１２３４５６", "123456\n7"]) assert.equal(normalizeCode(bad), null, bad);
});

test("a code matches only its own challenge", () => {
  const id = newChallengeId();
  const hash = hashCode("123456", id, SECRET);
  assert.equal(codeMatches("123456", hash, id, SECRET), true);
  assert.equal(codeMatches("123 456", hash, id, SECRET), true);
  assert.equal(codeMatches("654321", hash, id, SECRET), false);
  assert.equal(codeMatches("123456", hash, newChallengeId(), SECRET), false, "another challenge");
  assert.equal(codeMatches("123456", hash, id, `${SECRET}x`), false, "another secret");
  assert.equal(codeMatches("abcdef", hash, id, SECRET), false);
  assert.equal(codeMatches("123456", "short", id, SECRET), false);
});

test("the stored hash is not the code", () => {
  const id = newChallengeId();
  assert.equal(hashCode("123456", id, SECRET).includes("123456"), false);
  assert.match(hashCode("123456", id, SECRET), /^[0-9a-f]{64}$/);
});

test("challenge status: open, locked after five wrong codes, expired, verified, consumed", () => {
  assert.equal(challengeStatus(row(), NOW), "open");
  assert.equal(challengeStatus(row({ attempts: MFA_MAX_ATTEMPTS - 1 }), NOW), "open");
  assert.equal(challengeStatus(row({ attempts: MFA_MAX_ATTEMPTS }), NOW), "locked");
  assert.equal(challengeStatus(row({ expiresAt: new Date(NOW) }), NOW), "expired");
  assert.equal(challengeStatus(row({ verifiedAt: new Date(NOW - 1) }), NOW), "verified");
  assert.equal(challengeStatus(row({ verifiedAt: new Date(NOW - 1), consumedAt: new Date(NOW) }), NOW), "consumed");
  assert.equal(challengeStatus(row({ attempts: 9, expiresAt: new Date(NOW - 1) }), NOW), "expired");
});

test("a verified challenge is usable for 60 seconds, once", () => {
  const verifiedAt = new Date(NOW - 1000);
  assert.equal(verifiedWithinWindow({ verifiedAt, consumedAt: null }, NOW), true);
  assert.equal(verifiedWithinWindow({ verifiedAt: new Date(NOW - MFA_VERIFIED_WINDOW_SECONDS * 1000), consumedAt: null }, NOW), true);
  assert.equal(verifiedWithinWindow({ verifiedAt: new Date(NOW - MFA_VERIFIED_WINDOW_SECONDS * 1000 - 1), consumedAt: null }, NOW), false);
  assert.equal(verifiedWithinWindow({ verifiedAt, consumedAt: new Date(NOW) }, NOW), false);
  assert.equal(verifiedWithinWindow({ verifiedAt: null, consumedAt: null }, NOW), false);
});

test("a resend inherits the attempts of the latest unexpired challenge", () => {
  assert.equal(inheritedAttempts(null, NOW), 0);
  assert.equal(inheritedAttempts({ attempts: 3, expiresAt: new Date(NOW + 1000) }, NOW), 3);
  assert.equal(inheritedAttempts({ attempts: 3, expiresAt: new Date(NOW) }, NOW), 0, "expired: fresh start");
  assert.equal(inheritedAttempts({ attempts: 99, expiresAt: new Date(NOW + 1000) }, NOW), MFA_MAX_ATTEMPTS);
});
