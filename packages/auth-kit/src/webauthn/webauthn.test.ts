import assert from "node:assert/strict";
import { test } from "node:test";

import { createMfa } from "../mfa/mfa";
import { FakeAdapter } from "../test-support/fake-adapter";
import { createPasskeys, type PasskeysDeps } from "./index";

// The WebAuthn library is replaced with a stub that checks the challenge the
// same way the real one does (through the expectedChallenge function), so
// these tests cover the ceremony bookkeeping: single-use challenges, owner
// checks, the counter, recovery codes and the sign-in ticket.

const SECRET = "test-auth-secret-0123456789-abcdefghijklmnop";

function harness() {
  const adapter = new FakeAdapter();
  const user = adapter.addUser({ email: "owner@example.com", passwordHash: "x", role: "DEVELOPER", name: "Owner" });
  const audits: string[] = [];
  const mfa = createMfa({
    adapter,
    authSecret: SECRET,
    limit: async () => ({ ok: true }),
    sendEmail: async () => ({ ok: true }),
    audit: async (event) => void audits.push(event.action),
    claimOnce: async () => true,
    renderMfaCode: ({ code }) => ({ subject: "c", html: code, text: code }),
  });
  let issued = "";
  const lib = {
    async generateRegistrationOptions() {
      issued = `reg-${Math.random()}`;
      return { challenge: issued } as never;
    },
    async generateAuthenticationOptions() {
      issued = `auth-${Math.random()}`;
      return { challenge: issued } as never;
    },
    async verifyRegistrationResponse(options: { response: { challenge: string }; expectedChallenge: (c: string) => boolean }) {
      const ok = options.expectedChallenge(options.response.challenge);
      return (ok
        ? { verified: true, registrationInfo: { credential: { id: "cred-1", publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ["internal"] }, credentialDeviceType: "multiDevice", credentialBackedUp: true } }
        : { verified: false }) as never;
    },
    async verifyAuthenticationResponse(options: {
      response: { challenge: string; counter: number; userVerified?: boolean };
      expectedChallenge: (c: string) => boolean | Promise<boolean>;
      credential: { counter: number };
      requireUserVerification?: boolean;
    }) {
      const challengeOk = await options.expectedChallenge(options.response.challenge);
      const uvOk = !options.requireUserVerification || options.response.userVerified !== false;
      const ok = challengeOk && uvOk && options.response.counter > options.credential.counter;
      return { verified: ok, authenticationInfo: { newCounter: options.response.counter, userVerified: options.response.userVerified !== false } } as never;
    },
  } as unknown as PasskeysDeps["lib"];
  const stored = new Set<string>();
  const challengeStore = {
    async put(key: string) {
      stored.add(key);
    },
    async take(key: string) {
      return stored.delete(key);
    },
  };
  const passkeys = createPasskeys({ adapter, mfa, authSecret: SECRET, audit: async (event) => void audits.push(event.action), rpName: "Sahan", rpID: "example.com", origin: "https://example.com", lib, challengeStore });
  return { adapter, user, mfa, passkeys, audits, issued: () => issued };
}

const registration = (challenge: string) => ({ challenge, response: { transports: ["internal"] } }) as never;
const assertion = (challenge: string, counter: number, id = "cred-1") => ({ id, challenge, counter }) as never;

test("registering a passkey: the challenge is single use, and the first strong factor issues recovery codes", async () => {
  const h = harness();
  const { challengeId } = await h.passkeys.registrationOptions(h.user);
  const result = await h.passkeys.verifyRegistration(h.user, { challengeId, response: registration(h.issued()), name: " Laptop " });
  assert.ok(result.ok);
  assert.equal(result.recoveryCodes?.length, 10);
  const [saved] = await h.adapter.listPasskeys(h.user.id);
  assert.equal(saved.name, "Laptop");
  assert.equal(saved.publicKey, Buffer.from([1, 2, 3]).toString("base64url"));
  assert.deepEqual(await h.passkeys.verifyRegistration(h.user, { challengeId, response: registration(h.issued()), name: "Again" }), { ok: false, reason: "expired" });
  assert.ok(h.audits.includes("auth.mfa.passkey_added"));
});

test("a registration answering another challenge is refused", async () => {
  const h = harness();
  const { challengeId } = await h.passkeys.registrationOptions(h.user);
  assert.deepEqual(await h.passkeys.verifyRegistration(h.user, { challengeId, response: registration("forged"), name: "x" }), { ok: false, reason: "invalid" });
  assert.deepEqual(await h.adapter.listPasskeys(h.user.id), []);
});

test("signing in with a passkey verifies the ticket, records the counter, and refuses a replay", async () => {
  const h = harness();
  const reg = await h.passkeys.registrationOptions(h.user);
  await h.passkeys.verifyRegistration(h.user, { challengeId: reg.challengeId, response: registration(h.issued()), name: "Laptop" });

  const ticket = await h.mfa.openTicket({ userId: h.user.id, purpose: "SIGN_IN" });
  assert.ok(ticket.ok);
  const options = await h.passkeys.authenticationOptions(h.user.id);
  assert.ok(options);
  const input = { ticketId: ticket.challengeId, challengeId: options.challengeId, userId: h.user.id, email: h.user.email };
  assert.deepEqual(await h.passkeys.verifyAuthentication({ ...input, response: assertion(h.issued(), 5) }), { ok: true });
  assert.equal((await h.adapter.findPasskey("cred-1"))?.counter, 5);
  assert.ok(await h.mfa.consumeChallenge({ challengeId: ticket.challengeId, userId: h.user.id, purpose: "SIGN_IN" }));

  // The same assertion again: its ceremony challenge is spent.
  const second = await h.mfa.openTicket({ userId: h.user.id, purpose: "SIGN_IN" });
  assert.ok(second.ok);
  const replay = await h.passkeys.verifyAuthentication({ ...input, ticketId: second.challengeId, response: assertion(h.issued(), 6) });
  assert.deepEqual(replay, { ok: false, reason: "invalid" });
});

test("another user's passkey cannot verify this user's ticket", async () => {
  const h = harness();
  const other = h.adapter.addUser({ email: "other@example.com", passwordHash: "x", role: "EDITOR" });
  await h.adapter.createPasskey({ id: "theirs", userId: other.id, publicKey: "AQID", counter: 0, transports: [], deviceType: "singleDevice", backedUp: false, name: "Theirs" });
  await h.adapter.createPasskey({ id: "mine", userId: h.user.id, publicKey: "AQID", counter: 0, transports: [], deviceType: "singleDevice", backedUp: false, name: "Mine" });
  const ticket = await h.mfa.openTicket({ userId: h.user.id, purpose: "SIGN_IN" });
  assert.ok(ticket.ok);
  const options = await h.passkeys.authenticationOptions(h.user.id);
  assert.ok(options);
  const result = await h.passkeys.verifyAuthentication({ ticketId: ticket.challengeId, challengeId: options.challengeId, userId: h.user.id, email: h.user.email, response: assertion(h.issued(), 1, "theirs") });
  assert.deepEqual(result, { ok: false, reason: "invalid" });
});

test("no passkeys means no sign-in options; removing the last strong factor drops recovery codes", async () => {
  const h = harness();
  assert.equal(await h.passkeys.authenticationOptions(h.user.id), null);
  const reg = await h.passkeys.registrationOptions(h.user);
  await h.passkeys.verifyRegistration(h.user, { challengeId: reg.challengeId, response: registration(h.issued()), name: "Laptop" });
  assert.equal(await h.passkeys.removePasskey(h.user, "nope"), false);
  assert.equal(await h.passkeys.removePasskey(h.user, "cred-1"), true);
  assert.equal((await h.adapter.findMfaFactors(h.user.id))?.recoveryCodesLeft, 0);
});

const passwordlessAssertion = (challenge: string, counter: number, id: string, userHandle: string | null, userVerified = true) =>
  ({ id, challenge, counter, userVerified, response: userHandle === null ? {} : { userHandle: Buffer.from(userHandle).toString("base64url") } }) as never;

test("passwordless: the passkey's own user signs in once per challenge, with user verification", async () => {
  const h = harness();
  await h.adapter.createPasskey({ id: "mine", userId: h.user.id, publicKey: "AQID", counter: 0, transports: [], deviceType: "multiDevice", backedUp: true, name: "Mine" });
  await h.passkeys.passwordlessOptions();
  const challenge = h.issued();
  assert.deepEqual(await h.passkeys.verifyPasswordless(passwordlessAssertion(challenge, 1, "mine", h.user.id)), { ok: true, userId: h.user.id, passkeyId: "mine" });
  assert.equal((await h.adapter.findPasskey("mine"))?.counter, 1);
  // The challenge was taken: the same answer again is refused.
  assert.equal((await h.passkeys.verifyPasswordless(passwordlessAssertion(challenge, 2, "mine", h.user.id))).ok, false);
});

test("passwordless: two users on one device each get their own account, and a mismatched user handle is refused", async () => {
  const h = harness();
  const other = h.adapter.addUser({ email: "other@example.com", passwordHash: "x", role: "EDITOR" });
  await h.adapter.createPasskey({ id: "mine", userId: h.user.id, publicKey: "AQID", counter: 0, transports: [], deviceType: "multiDevice", backedUp: true, name: "Mine" });
  await h.adapter.createPasskey({ id: "theirs", userId: other.id, publicKey: "AQID", counter: 0, transports: [], deviceType: "multiDevice", backedUp: true, name: "Theirs" });

  await h.passkeys.passwordlessOptions();
  assert.deepEqual(await h.passkeys.verifyPasswordless(passwordlessAssertion(h.issued(), 1, "theirs", other.id)), { ok: true, userId: other.id, passkeyId: "theirs" });

  await h.passkeys.passwordlessOptions();
  assert.equal((await h.passkeys.verifyPasswordless(passwordlessAssertion(h.issued(), 2, "mine", other.id))).ok, false, "credential and user handle disagree");
});

test("passwordless: refused without user verification, for an unknown credential, or for a challenge never issued", async () => {
  const h = harness();
  await h.adapter.createPasskey({ id: "mine", userId: h.user.id, publicKey: "AQID", counter: 0, transports: [], deviceType: "multiDevice", backedUp: true, name: "Mine" });
  await h.passkeys.passwordlessOptions();
  const challenge = h.issued();
  assert.equal((await h.passkeys.verifyPasswordless(passwordlessAssertion(challenge, 1, "mine", h.user.id, false))).ok, false);
  assert.deepEqual(await h.passkeys.verifyPasswordless(passwordlessAssertion("never-issued", 1, "mine", h.user.id)), { ok: false, reason: "invalid" });
  assert.deepEqual(await h.passkeys.verifyPasswordless(passwordlessAssertion(challenge, 1, "unknown", h.user.id)), { ok: false, reason: "invalid" });
});
