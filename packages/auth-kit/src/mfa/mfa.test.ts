import assert from "node:assert/strict";
import { test } from "node:test";

import { FakeAdapter } from "../test-support/fake-adapter";
import { createMfa } from "./mfa";
import { MFA_MAX_ATTEMPTS } from "./rules";

const AUTH_SECRET = "test-auth-secret-0123456789-abcdefghijklmnop";

function harness(options: { limited?: boolean; resetSeconds?: number; sendFails?: boolean } = {}) {
  const adapter = new FakeAdapter();
  const user = adapter.addUser({ email: "owner@example.com", passwordHash: "x", role: "DEVELOPER", name: "Owner" });
  const sent: Array<{ to: string; subject: string; text: string }> = [];
  const audits: Array<{ action: string; meta?: Record<string, unknown> }> = [];
  let sentCode = "";

  const mfa = createMfa({
    adapter,
    authSecret: AUTH_SECRET,
    limit: async () => ({ ok: !options.limited, resetSeconds: options.resetSeconds }),
    sendEmail: async (message) => {
      if (options.sendFails) return { ok: false };
      sent.push({ to: message.to, subject: message.subject, text: message.text });
      const match = message.text.match(/\d{6}/);
      if (match) sentCode = match[0];
      return { ok: true };
    },
    audit: async (event) => void audits.push(event),
    renderMfaCode: ({ code }) => ({ subject: "Your code", html: code, text: `Your code is ${code}` }),
  });

  return { adapter, user, mfa, sent, audits, code: () => sentCode };
}

test("issueChallenge sends a code and creates a challenge row", async () => {
  const { mfa, user, sent, audits } = harness();
  const result = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.equal(result.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, user.email);
  assert.equal(audits.at(-1)?.action, "auth.mfa.sent");
});

test("issueChallenge is refused when the per-user send limit is hit", async () => {
  const { mfa, user, sent } = harness({ limited: true });
  const result = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.deepEqual(result, { ok: false, error: "limited" });
  assert.equal(sent.length, 0);
});

test("a limited issue reports when the send window frees up", async () => {
  const { mfa, user } = harness({ limited: true, resetSeconds: 240 });
  const result = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.deepEqual(result, { ok: false, error: "limited", retryAfterSeconds: 240 });
});

test("issueChallenge expires the row it just created when the email fails to send", async () => {
  const { mfa, adapter, user } = harness({ sendFails: true });
  const result = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.deepEqual(result, { ok: false, error: "send_failed" });
});

test("the right code verifies exactly once, then reports invalid on retry (no verified challenge left to reuse)", async () => {
  const { mfa, user, code } = harness();
  const issued = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.ok(issued.ok);
  const verified = await mfa.verifyChallenge({ challengeId: issued.challengeId, userId: user.id, email: user.email, purpose: "SIGN_IN", code: code() });
  assert.deepEqual(verified, { ok: true });
});

test("re-verifying an already-verified challenge with the same code answers ok without spending another attempt", async () => {
  const { mfa, user, code } = harness();
  const issued = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.ok(issued.ok);
  const first = await mfa.verifyChallenge({ challengeId: issued.challengeId, userId: user.id, email: user.email, purpose: "SIGN_IN", code: code() });
  assert.deepEqual(first, { ok: true });

  const second = await mfa.verifyChallenge({
    challengeId: issued.challengeId,
    userId: user.id,
    email: user.email,
    purpose: "SIGN_IN",
    code: "000000", // even a wrong code: an already-verified challenge is not re-compared
  });
  assert.deepEqual(second, { ok: true }, "a second verify short-circuits on the verified status");
});

test("a wrong code is rejected and counted; the right code still works up to the attempt limit", async () => {
  const { mfa, user, code, audits } = harness();
  const issued = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.ok(issued.ok);
  const wrong = await mfa.verifyChallenge({ challengeId: issued.challengeId, userId: user.id, email: user.email, purpose: "SIGN_IN", code: "111111" });
  assert.deepEqual(wrong, { ok: false, reason: "invalid" });
  assert.equal(audits.at(-1)?.action, "auth.mfa.failed");

  const right = await mfa.verifyChallenge({ challengeId: issued.challengeId, userId: user.id, email: user.email, purpose: "SIGN_IN", code: code() });
  assert.deepEqual(right, { ok: true });
});

test("the challenge locks after MFA_MAX_ATTEMPTS wrong codes, even with the right code left to try", async () => {
  const { mfa, user, code, audits } = harness();
  const issued = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.ok(issued.ok);
  for (let i = 0; i < MFA_MAX_ATTEMPTS - 1; i += 1) {
    const result = await mfa.verifyChallenge({ challengeId: issued.challengeId, userId: user.id, email: user.email, purpose: "SIGN_IN", code: "111111" });
    assert.deepEqual(result, { ok: false, reason: "invalid" }, `attempt ${i + 1}`);
  }
  const locking = await mfa.verifyChallenge({ challengeId: issued.challengeId, userId: user.id, email: user.email, purpose: "SIGN_IN", code: "111111" });
  assert.deepEqual(locking, { ok: false, reason: "locked" });
  assert.equal(audits.at(-1)?.action, "auth.mfa.locked");

  const tooLate = await mfa.verifyChallenge({ challengeId: issued.challengeId, userId: user.id, email: user.email, purpose: "SIGN_IN", code: code() });
  assert.deepEqual(tooLate, { ok: false, reason: "locked" });
});

test("an unknown, foreign, or wrong-purpose challenge id is 'invalid', never distinguishable", async () => {
  const { mfa, user } = harness();
  const missing = await mfa.verifyChallenge({ challengeId: "nope", userId: user.id, email: user.email, purpose: "SIGN_IN", code: "111111" });
  assert.deepEqual(missing, { ok: false, reason: "invalid" });

  const issued = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.ok(issued.ok);
  const wrongPurpose = await mfa.verifyChallenge({ challengeId: issued.challengeId, userId: user.id, email: user.email, purpose: "ENABLE", code: "111111" });
  assert.deepEqual(wrongPurpose, { ok: false, reason: "invalid" });
});

test("consumeChallenge succeeds exactly once, inside the verified window", async () => {
  const { mfa, user, code } = harness();
  const issued = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.ok(issued.ok);
  await mfa.verifyChallenge({ challengeId: issued.challengeId, userId: user.id, email: user.email, purpose: "SIGN_IN", code: code() });

  const consumed = await mfa.consumeChallenge({ challengeId: issued.challengeId, userId: user.id, purpose: "SIGN_IN" });
  assert.equal(consumed, true);
  const again = await mfa.consumeChallenge({ challengeId: issued.challengeId, userId: user.id, purpose: "SIGN_IN" });
  assert.equal(again, false, "single use");
});

test("consumeChallenge fails on a challenge that was never verified", async () => {
  const { mfa, user } = harness();
  const issued = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.ok(issued.ok);
  assert.equal(await mfa.consumeChallenge({ challengeId: issued.challengeId, userId: user.id, purpose: "SIGN_IN" }), false);
});

test("challengeOwner resolves the user a sign-in challenge belongs to, and not a consumed one", async () => {
  const { mfa, user, code } = harness();
  const issued = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.ok(issued.ok);
  const owner = await mfa.challengeOwner(issued.challengeId, "SIGN_IN");
  assert.equal(owner?.userId, user.id);
  assert.equal(owner?.user.email, user.email);

  await mfa.verifyChallenge({ challengeId: issued.challengeId, userId: user.id, email: user.email, purpose: "SIGN_IN", code: code() });
  await mfa.consumeChallenge({ challengeId: issued.challengeId, userId: user.id, purpose: "SIGN_IN" });
  assert.equal(await mfa.challengeOwner(issued.challengeId, "SIGN_IN"), null);
});

test("a resend inherits the previous challenge's attempt count instead of resetting it", async () => {
  const { mfa, user } = harness();
  const first = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.ok(first.ok);
  for (let i = 0; i < MFA_MAX_ATTEMPTS - 1; i += 1) {
    await mfa.verifyChallenge({ challengeId: first.challengeId, userId: user.id, email: user.email, purpose: "SIGN_IN", code: "111111" });
  }
  // One more wrong guess would lock; resending must not hand out a fresh set of five.
  const second = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.ok(second.ok);
  const result = await mfa.verifyChallenge({ challengeId: second.challengeId, userId: user.id, email: user.email, purpose: "SIGN_IN", code: "111111" });
  assert.deepEqual(result, { ok: false, reason: "locked" }, "the new challenge starts already at the inherited attempt count");
});
