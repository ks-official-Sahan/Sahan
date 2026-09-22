import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateSession, passwordFingerprint, type SessionState } from "./session-state";

const NOW = 1_800_000_000_000;
const SECRET = "test-auth-secret-0123456789-abcdefghijklmnop";
const pwf = passwordFingerprint("$2b$12$hash-of-the-current-password", SECRET);

const state: SessionState = {
  userId: "u1",
  email: "owner@example.com",
  name: "Owner",
  role: "DEVELOPER",
  disabled: false,
  revoked: false,
  expiresAt: NOW + 60_000,
  pwf,
  mustChangePassword: false,
  mfaEnabled: false,
  mfaVerified: false,
};
const claims = { sub: "u1", pwf };

test("a live session for the right user and password is accepted", () => {
  assert.deepEqual(evaluateSession(state, claims, NOW), { ok: true });
});

test("each way of ending a session is refused with its reason", () => {
  assert.deepEqual(evaluateSession(null, claims, NOW), { ok: false, reason: "missing" });
  assert.deepEqual(evaluateSession({ ...state, revoked: true }, claims, NOW), { ok: false, reason: "revoked" });
  assert.deepEqual(evaluateSession({ ...state, expiresAt: NOW }, claims, NOW), { ok: false, reason: "expired" });
  assert.deepEqual(evaluateSession({ ...state, disabled: true }, claims, NOW), { ok: false, reason: "disabled" });
});

test("a token for another user, or with no subject, is refused", () => {
  assert.deepEqual(evaluateSession(state, { sub: "u2", pwf }, NOW), { ok: false, reason: "user_mismatch" });
  assert.deepEqual(evaluateSession(state, { sub: undefined, pwf }, NOW), { ok: false, reason: "user_mismatch" });
});

test("a changed password ends older sessions", () => {
  const changed = passwordFingerprint("$2b$12$hash-of-a-new-password", SECRET);
  assert.deepEqual(evaluateSession({ ...state, pwf: changed }, claims, NOW), { ok: false, reason: "password_changed" });
  assert.deepEqual(evaluateSession(state, { sub: "u1", pwf: undefined }, NOW), { ok: false, reason: "password_changed" });
});

test("the fingerprint is stable, short and depends on both inputs", () => {
  assert.equal(pwf, passwordFingerprint("$2b$12$hash-of-the-current-password", SECRET));
  assert.match(pwf, /^[0-9a-f]{16}$/);
  assert.notEqual(pwf, passwordFingerprint("$2b$12$hash-of-the-current-password", `${SECRET}x`));
  assert.ok(!pwf.includes("hash-of"));
});
