import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { test } from "node:test";

import { createToken, hashToken, tokenState, verifyTokenTag } from "./invite-token";

const SECRET = "test-auth-secret-0123456789-abcdefghijklmnop";

test("a fresh token verifies and yields the random part whose hash is stored", () => {
  const { token, hash } = createToken(SECRET);
  const random = verifyTokenTag(token, SECRET);
  assert.ok(random);
  assert.equal(hashToken(random), hash);
  // v2: 128 random bits and a 64-bit tag, 34 characters in all.
  assert.match(token, /^[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{11}$/);
});

test("a v1 token (32 random bytes, 128-bit tag) from a link already sent still verifies", () => {
  const random = randomBytes(32).toString("base64url");
  const tag = createHmac("sha256", createHmac("sha256", SECRET).update("invite-token:v1").digest())
    .update(random)
    .digest()
    .subarray(0, 16)
    .toString("base64url");
  assert.equal(verifyTokenTag(`${random}.${tag}`, SECRET), random);
  // A v1 random part with a v2-length tag is neither format.
  assert.equal(verifyTokenTag(`${random}.${tag.slice(0, 11)}`, SECRET), null);
});

test("the stored hash alone cannot rebuild a valid link", () => {
  const { token, hash } = createToken(SECRET);
  assert.equal(token.includes(hash), false);
  assert.equal(verifyTokenTag(`${hash}.${"A".repeat(22)}`, SECRET), null);
});

test("tokens are unique", () => {
  assert.notEqual(createToken(SECRET).token, createToken(SECRET).token);
});

test("a changed random part, tag or secret is refused", () => {
  const { token } = createToken(SECRET);
  const [random, tag] = token.split(".");
  const flip = (value: string) => (value[0] === "A" ? "B" : "A") + value.slice(1);
  assert.equal(verifyTokenTag(`${flip(random)}.${tag}`, SECRET), null);
  assert.equal(verifyTokenTag(`${random}.${flip(tag)}`, SECRET), null);
  assert.equal(verifyTokenTag(token, `${SECRET}x`), null);
  assert.equal(verifyTokenTag(token, undefined), null);
});

test("malformed tokens are refused without throwing", () => {
  for (const bad of [null, undefined, "", "abc", "a.b", "a.b.c", ".", `${"A".repeat(43)}.`, `.${"A".repeat(22)}`, "A".repeat(500), `${"A".repeat(43)}.${"A".repeat(22)}.x`, "../../etc/passwd"]) {
    assert.equal(verifyTokenTag(bad, SECRET), null, String(bad));
  }
});

test("token state: single use, expiry and revocation", () => {
  const now = Date.now();
  const base = { usedAt: null, revokedAt: null, expiresAt: new Date(now + 1000) };
  assert.equal(tokenState(base, now), "valid");
  assert.equal(tokenState({ ...base, usedAt: new Date(now - 1) }, now), "used");
  assert.equal(tokenState({ ...base, expiresAt: new Date(now) }, now), "expired");
  assert.equal(tokenState({ ...base, expiresAt: new Date(now - 1) }, now), "expired");
  assert.equal(tokenState({ ...base, revokedAt: new Date(now - 1) }, now), "revoked");
  assert.equal(tokenState({ ...base, revokedAt: new Date(now), usedAt: new Date(now) }, now), "revoked");
});
