import assert from "node:assert/strict";
import { test } from "node:test";

import {
  UNLOCK_TTL_SECONDS,
  constantTimeEqual,
  isUnlockSecret,
  signUnlockCookie,
  unlockCookieOptions,
  unlockKeysFromEnv,
  verifyUnlockCookie,
  type UnlockKeys,
} from "./login-unlock";

const keys: UnlockKeys = {
  authSecret: "test-auth-secret-0123456789-abcdefghijklmnop",
  unlockSecret: "test-unlock-secret",
};
const NOW = 1_800_000_000_000;

test("a freshly signed cookie verifies", () => {
  assert.equal(verifyUnlockCookie(signUnlockCookie(NOW, keys), NOW, keys), true);
  assert.equal(verifyUnlockCookie(signUnlockCookie(NOW, keys), NOW + 60 * 60 * 1000, keys), true);
});

test("it expires after the two hour lifetime", () => {
  const cookie = signUnlockCookie(NOW, keys);
  const ttl = UNLOCK_TTL_SECONDS * 1000;
  assert.equal(verifyUnlockCookie(cookie, NOW + ttl, keys), true);
  assert.equal(verifyUnlockCookie(cookie, NOW + ttl + 1, keys), false);
});

test("a timestamp from the future is refused beyond one minute of skew", () => {
  const cookie = signUnlockCookie(NOW + 30_000, keys);
  assert.equal(verifyUnlockCookie(cookie, NOW, keys), true);
  const far = signUnlockCookie(NOW + 61_000, keys);
  assert.equal(verifyUnlockCookie(far, NOW, keys), false);
});

test("tampering with the timestamp or the signature fails", () => {
  const [issued, signature] = signUnlockCookie(NOW, keys).split(".");
  assert.equal(verifyUnlockCookie(`${Number(issued) + 1000}.${signature}`, NOW, keys), false);
  assert.equal(verifyUnlockCookie(`${issued}.${signature.slice(0, -2)}AA`, NOW, keys), false);
  assert.equal(verifyUnlockCookie(`${issued}.`, NOW, keys), false);
});

test("malformed values never verify and never throw", () => {
  for (const value of [undefined, null, "", ".", "abc", "1.2.3", `${NOW}`, "x".repeat(500), `-${NOW}.aaaa`, `${NOW}.${"a".repeat(200)}`]) {
    assert.equal(verifyUnlockCookie(value, NOW, keys), false, String(value));
  }
});

test("rotating either secret invalidates issued cookies", () => {
  const cookie = signUnlockCookie(NOW, keys);
  assert.equal(verifyUnlockCookie(cookie, NOW, { ...keys, unlockSecret: "another-unlock" }), false);
  assert.equal(verifyUnlockCookie(cookie, NOW, { ...keys, authSecret: `${keys.authSecret}x` }), false);
});

test("isUnlockSecret matches only the configured value", () => {
  assert.equal(isUnlockSecret("test-unlock-secret", keys), true);
  assert.equal(isUnlockSecret("test-unlock-secre", keys), false);
  assert.equal(isUnlockSecret("test-unlock-secret-and-more", keys), false);
  assert.equal(isUnlockSecret("", keys), false);
  assert.equal(isUnlockSecret(null, keys), false);
  assert.equal(isUnlockSecret(undefined, keys), false);
});

test("constantTimeEqual copes with different lengths", () => {
  assert.equal(constantTimeEqual("a", "a"), true);
  assert.equal(constantTimeEqual("a", "aa"), false);
  assert.equal(constantTimeEqual("", ""), true);
});

test("the keys need both secrets", () => {
  assert.equal(unlockKeysFromEnv({ AUTH_SECRET: "a" }), null);
  assert.equal(unlockKeysFromEnv({ ADMIN_LOGIN_UNLOCK_SECRET: "b" }), null);
  assert.deepEqual(unlockKeysFromEnv({ AUTH_SECRET: "a", ADMIN_LOGIN_UNLOCK_SECRET: "b" }), {
    authSecret: "a",
    unlockSecret: "b",
  });
});

test("cookie options widen to Path=/ in production (for __Host-) and stay /admin, insecure, in development", () => {
  assert.deepEqual(unlockCookieOptions(true), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: UNLOCK_TTL_SECONDS,
  });
  assert.deepEqual(unlockCookieOptions(false), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/admin",
    maxAge: UNLOCK_TTL_SECONDS,
  });
});
