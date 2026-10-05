import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SIGN_IN_LINK_DEFAULT_DAYS,
  SIGN_IN_LINK_MAX_DAYS,
  UNLOCK_TTL_SECONDS,
  constantTimeEqual,
  isUnlockSecret,
  loginUnlockEnabled,
  signInLinkDays,
  signSignInLink,
  signUnlockCookie,
  unlockCookieOptions,
  unlockKeysFromEnv,
  verifySignInLink,
  verifyUnlockCookie,
  type UnlockKeys,
} from "./login-unlock";

const keys: UnlockKeys = {
  authSecret: "test-auth-secret-0123456789-abcdefghijklmnop",
  unlockSecret: "test-unlock-secret",
};
const NOW = 1_800_000_000_000;

test("loginUnlockEnabled: on only when the unlock secret is set", () => {
  assert.equal(loginUnlockEnabled({ ADMIN_LOGIN_UNLOCK_SECRET: "a-long-unlock-secret" }), true);
  assert.equal(loginUnlockEnabled({ ADMIN_LOGIN_UNLOCK_SECRET: "   " }), false);
  assert.equal(loginUnlockEnabled({}), false);
});

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

const DAY = 24 * 60 * 60 * 1000;

test("a sign-in link is short, verifies until it expires, and never carries the secret", () => {
  const code = signSignInLink(NOW, 14, keys);
  assert.match(code, /^[0-9a-z]{6,9}.[A-Za-z0-9_-]{16}$/);
  assert.ok(!code.includes(keys.unlockSecret));
  assert.equal(verifySignInLink(code, NOW, keys), true);
  assert.equal(verifySignInLink(code, NOW + 14 * DAY - 1000, keys), true);
  assert.equal(verifySignInLink(code, NOW + 14 * DAY + 1000, keys), false);
});

test("a sign-in link fails when tampered with, malformed, or after a secret rotates", () => {
  const code = signSignInLink(NOW, 14, keys);
  const [expiry, tag] = code.split(".");
  const later = (parseInt(expiry, 36) + 86_400).toString(36);
  assert.equal(verifySignInLink(`${later}.${tag}`, NOW, keys), false);
  const flipped = tag.slice(0, -1) + (tag.endsWith("A") ? "B" : "A");
  assert.equal(verifySignInLink(`${expiry}.${flipped}`, NOW, keys), false);
  for (const bad of [null, undefined, "", ".", code + ".x", "ABC." + tag, signUnlockCookie(NOW, keys)]) {
    assert.equal(verifySignInLink(bad, NOW, keys), false);
  }
  assert.equal(verifySignInLink(code, NOW, { ...keys, unlockSecret: "rotated" }), false);
  assert.equal(verifySignInLink(code, NOW, { ...keys, authSecret: "rotated-auth-secret-0123456789-abcdefgh" }), false);
});

test("the unlock cookie and a sign-in link never pass as each other", () => {
  assert.equal(verifyUnlockCookie(signSignInLink(NOW, 14, keys), NOW, keys), false);
  assert.equal(verifySignInLink(signUnlockCookie(NOW, keys), NOW, keys), false);
});

test("sign-in link lifetime is clamped to 1..90 days, and a longer one is refused", () => {
  assert.equal(signInLinkDays(undefined), SIGN_IN_LINK_DEFAULT_DAYS);
  assert.equal(signInLinkDays("abc"), SIGN_IN_LINK_DEFAULT_DAYS);
  assert.equal(signInLinkDays(" 30 "), 30);
  assert.equal(signInLinkDays("0"), 1);
  assert.equal(signInLinkDays(365), SIGN_IN_LINK_MAX_DAYS);
  const capped = signSignInLink(NOW, 365, keys);
  assert.equal(verifySignInLink(capped, NOW + (SIGN_IN_LINK_MAX_DAYS - 1) * DAY, keys), true);
  // Verified long before it was meant to be used: beyond the cap even though the tag is right.
  assert.equal(verifySignInLink(capped, NOW - 2 * DAY, keys), false);
});
