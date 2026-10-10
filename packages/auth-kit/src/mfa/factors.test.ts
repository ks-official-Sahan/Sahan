import assert from "node:assert/strict";
import { test } from "node:test";

import { mfaMethodsFor, mustSetUpStrongMfa, needsSecondStep } from "./factors";
import { generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode, RECOVERY_CODE_COUNT } from "./recovery";
import { openFactorSecret, sealFactorSecret } from "./sealed";
import { base32Decode, base32Encode, hotp, matchTotp, newTotpSecret, otpauthUri, totpAt } from "./totp";

test("HOTP matches the RFC 4226 test vectors", () => {
  const secret = Buffer.from("12345678901234567890");
  const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  expected.forEach((code, counter) => assert.equal(hotp(secret, counter), code));
});

test("TOTP matches the RFC 6238 SHA-1 vectors (last six digits)", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  assert.equal(totpAt(secret, 59_000), "287082");
  assert.equal(totpAt(secret, 1_111_111_109_000), "081804");
  assert.equal(totpAt(secret, 1_234_567_890_000), "005924");
  assert.equal(totpAt(secret, 2_000_000_000_000), "279037");
});

test("base32 round-trips any bytes", () => {
  for (const length of [0, 1, 5, 10, 20, 33]) {
    const bytes = Buffer.from(Array.from({ length }, (_, i) => (i * 37 + 11) % 256));
    assert.deepEqual(base32Decode(base32Encode(bytes)), bytes);
  }
  assert.equal(newTotpSecret().length, 32);
  assert.throws(() => base32Decode("not!base32"));
});

test("matchTotp accepts one step of drift either way, and nothing further", () => {
  const secret = newTotpSecret();
  const now = 1_700_000_000_000;
  const step = Math.floor(now / 30_000);
  assert.equal(matchTotp(secret, totpAt(secret, now), now), step);
  assert.equal(matchTotp(secret, totpAt(secret, now - 30_000), now), step - 1);
  assert.equal(matchTotp(secret, totpAt(secret, now + 30_000), now), step + 1);
  assert.equal(matchTotp(secret, totpAt(secret, now - 90_000), now), null);
  assert.equal(matchTotp(secret, "12345", now), null);
  assert.equal(matchTotp(secret, `${totpAt(secret, now).slice(0, 3)} ${totpAt(secret, now).slice(3)}`, now), step);
});

test("otpauth URI carries the secret, issuer and parameters", () => {
  const uri = new URL(otpauthUri({ issuer: "Sahan", account: "a@b.co", secret: "ABC" }));
  assert.equal(uri.protocol, "otpauth:");
  assert.equal(uri.searchParams.get("secret"), "ABC");
  assert.equal(uri.searchParams.get("issuer"), "Sahan");
  assert.equal(uri.searchParams.get("period"), "30");
});

test("recovery codes: shape, normalisation and a user-bound hash", () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, RECOVERY_CODE_COUNT);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) assert.match(code, /^[a-z2-9]{4}-[a-z2-9]{4}$/);
  assert.equal(normalizeRecoveryCode(" ABCD-efgh "), "abcdefgh");
  assert.equal(normalizeRecoveryCode("abc"), null);
  assert.equal(normalizeRecoveryCode("abcd-efg1"), null);
  assert.notEqual(hashRecoveryCode("abcdefgh", "u1", "s"), hashRecoveryCode("abcdefgh", "u2", "s"));
});

test("sealed factor secrets round-trip and refuse another key", () => {
  const sealed = sealFactorSecret("JBSWY3DPEHPK3PXP", "k".repeat(40));
  assert.notEqual(sealed, sealFactorSecret("JBSWY3DPEHPK3PXP", "k".repeat(40)));
  assert.equal(openFactorSecret(sealed, "k".repeat(40)), "JBSWY3DPEHPK3PXP");
  assert.throws(() => openFactorSecret(sealed, "j".repeat(40)));
});

test("method policy: email is a fallback that required roles lose once they have a strong factor", () => {
  const strong = ["SUPER_ADMIN", "DEVELOPER"];
  const emailOnly = { emailOtp: true, totp: false, passkeys: 0, recoveryCodesLeft: 0 };
  const withTotp = { emailOtp: true, totp: true, passkeys: 0, recoveryCodesLeft: 10 };
  assert.deepEqual(mfaMethodsFor("DEVELOPER", emailOnly, strong), { email: true, totp: false, passkey: false, recovery: false });
  assert.deepEqual(mfaMethodsFor("DEVELOPER", withTotp, strong), { email: false, totp: true, passkey: false, recovery: true });
  assert.deepEqual(mfaMethodsFor("EDITOR", withTotp, strong), { email: true, totp: true, passkey: false, recovery: true });
  assert.equal(mustSetUpStrongMfa("DEVELOPER", emailOnly, strong), true);
  assert.equal(mustSetUpStrongMfa("DEVELOPER", { totp: false, passkeys: 1 }, strong), false);
  assert.equal(mustSetUpStrongMfa("EDITOR", emailOnly, strong), false);
  assert.equal(needsSecondStep({ emailOtp: false, totp: false, passkeys: 1, recoveryCodesLeft: 0 }), true);
  assert.equal(needsSecondStep({ emailOtp: false, totp: false, passkeys: 0, recoveryCodesLeft: 5 }), false);
});
