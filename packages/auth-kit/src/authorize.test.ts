import assert from "node:assert/strict";
import { test } from "node:test";

import { createAuthorize, type AuthorizeDeps } from "./authorize";
import { MemoryKv } from "./cache/memory";
import { createMfa } from "./mfa/mfa";
import { hashPassword } from "./password";
import { createSessionStore } from "./session/store";
import { FakeAdapter } from "./test-support/fake-adapter";

const AUTH_SECRET = "test-auth-secret-0123456789-abcdefghijklmnop";
const request = (ua = "Mozilla/5.0") => ({ headers: new Headers({ "user-agent": ua }) });

async function harness(options: { acctLimited?: boolean } = {}) {
  const adapter = new FakeAdapter();
  const kv = new MemoryKv();
  const sessionStore = createSessionStore({ adapter, kv, authSecret: AUTH_SECRET });
  let sentCode = "";
  const mfa = createMfa({
    adapter,
    authSecret: AUTH_SECRET,
    limit: async () => ({ ok: true }),
    sendEmail: async (message) => {
      const match = message.text.match(/\d{6}/);
      if (match) sentCode = match[0];
      return { ok: true };
    },
    audit: async () => undefined,
    renderMfaCode: ({ code }) => ({ subject: "code", html: code, text: `code ${code}` }),
  });

  const audits: Array<{ action: string }> = [];
  const knownDeviceEmails: string[] = [];
  const deps: AuthorizeDeps = {
    adapter,
    authSecret: AUTH_SECRET,
    keyPrefix: "test:",
    sessionStore,
    mfa,
    bootstrap: async () => undefined,
    loginFailureWindowSeconds: 900,
    loginFailureMaxAttempts: 5,
    limit: async () => ({ ok: true }),
    // 6 > loginFailureMaxAttempts (5): every credentialed attempt looks
    // like it is already over the account's own failure ceiling, the same
    // "limited" path an account-lockout scenario takes in credentials.ts.
    failures: { reserve: async () => (options.acctLimited ? 6 : 1), clear: async () => undefined },
    audit: async (event) => void audits.push(event),
    warn: () => undefined,
    after: (fn) => fn(),
    sendKnownDeviceEmail: async (input) => void knownDeviceEmails.push(input.email),
  };

  const passwordHash = await hashPassword("right-password");
  const user = adapter.addUser({ email: "owner@example.com", passwordHash, role: "DEVELOPER", name: "Owner" });

  return { adapter, authorize: createAuthorize(deps), user, audits, knownDeviceEmails, mfaCode: () => sentCode, mfa };
}

test("the right password signs in and returns a session-shaped user", async () => {
  const { authorize, user, audits } = await harness();
  const result = await authorize({ email: user.email, password: "right-password" }, request());
  assert.equal(result.kind, "signed_in");
  if (result.kind === "signed_in") {
    assert.equal(result.session.email, user.email);
    assert.equal(result.session.mfa, false);
    assert.ok(result.session.sid);
  }
  assert.equal(audits.at(-1)?.action, "auth.login.success");
});

test("a wrong password is invalid", async () => {
  const { authorize, user } = await harness();
  assert.deepEqual(await authorize({ email: user.email, password: "nope" }, request()), { kind: "invalid" });
});

test("an account over its own failure ceiling is refused even with the right password", async () => {
  const { authorize, user } = await harness({ acctLimited: true });
  assert.deepEqual(await authorize({ email: user.email, password: "right-password" }, request()), { kind: "limited" });
});

test("a right password for an MFA account asks for the second factor instead of signing in", async () => {
  const { adapter, authorize, user } = await harness();
  const row = adapter.getUser(user.id);
  assert.ok(row);
  row.mfaEnabled = true;
  assert.deepEqual(await authorize({ email: user.email, password: "right-password" }, request()), { kind: "mfa_required" });
});

test("the MFA second step signs in with a verified challenge id and no password", async () => {
  const { adapter, authorize, user, mfa, mfaCode } = await harness();
  const row = adapter.getUser(user.id);
  assert.ok(row);
  row.mfaEnabled = true;

  const issued = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.ok(issued.ok);
  const verified = await mfa.verifyChallenge({ challengeId: issued.challengeId, userId: user.id, email: user.email, purpose: "SIGN_IN", code: mfaCode() });
  assert.deepEqual(verified, { ok: true });

  const result = await authorize({ challengeId: issued.challengeId }, request());
  assert.equal(result.kind, "signed_in");
  if (result.kind === "signed_in") assert.equal(result.session.mfa, true);
});

test("the MFA second step is invalid without a prior verify (consumeChallenge fails)", async () => {
  const { authorize, mfa, user } = await harness();
  const issued = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.ok(issued.ok);
  assert.deepEqual(await authorize({ challengeId: issued.challengeId }, request()), { kind: "invalid" });
});

test("the MFA second step is invalid for an unknown challenge id", async () => {
  const { authorize } = await harness();
  assert.deepEqual(await authorize({ challengeId: "nope" }, request()), { kind: "invalid" });
});

test("a disabled account's MFA second step is invalid even with a verified challenge", async () => {
  const { adapter, authorize, mfa, user, mfaCode } = await harness();
  const row = adapter.getUser(user.id);
  assert.ok(row);
  row.mfaEnabled = true;

  const issued = await mfa.issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
  assert.ok(issued.ok);
  await mfa.verifyChallenge({ challengeId: issued.challengeId, userId: user.id, email: user.email, purpose: "SIGN_IN", code: mfaCode() });
  row.disabledAt = new Date();
  assert.deepEqual(await authorize({ challengeId: issued.challengeId }, request()), { kind: "invalid" });
});

test("a first sign-in from a new device emails the owner; a second from the same device does not", async () => {
  const { authorize, user, knownDeviceEmails } = await harness();
  await authorize({ email: user.email, password: "right-password" }, request("Mozilla/5.0 (Macintosh)"));
  // `after()` (next/server) schedules the email; under plain node it runs inline.
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(knownDeviceEmails, [user.email]);

  await authorize({ email: user.email, password: "right-password" }, request("Mozilla/5.0 (Macintosh)"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(knownDeviceEmails, [user.email], "no second email for a known device");
});
