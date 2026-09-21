import assert from "node:assert/strict";
import { test } from "node:test";

import type { AuditEvent } from "../admin/audit";
import { DUMMY_HASH, verifyCredentials, type CredentialDeps, type StoredUser } from "./credentials";

const user: StoredUser = {
  id: "u1",
  email: "owner@example.com",
  name: "Owner",
  role: "DEVELOPER",
  passwordHash: "hash-of-the-right-password",
  disabledAt: null,
  mfaEnabled: false,
};

function harness(overrides: Partial<CredentialDeps> & { users?: StoredUser[] } = {}) {
  const compared: string[] = [];
  const audits: AuditEvent[] = [];
  const warnings: string[] = [];
  const counts = new Map<string, number>();
  const deps: CredentialDeps = {
    ensureOwner: async () => undefined,
    findUser: async (email) => (overrides.users ?? [user]).find((entry) => entry.email === email) ?? null,
    compare: async (plain, hash) => {
      compared.push(hash);
      return plain === "right-password" && hash === user.passwordHash;
    },
    allowIp: async () => true,
    failures: {
      reserve: async (email) => {
        const next = (counts.get(email) ?? 0) + 1;
        counts.set(email, next);
        return next;
      },
      clear: async (email) => void counts.delete(email),
    },
    audit: async (event) => void audits.push(event),
    warn: (message) => void warnings.push(message),
    ...overrides,
  };
  return { deps, compared, audits, warnings, counts };
}

const attempt = (email: unknown, password: unknown) => ({
  email,
  password,
  ip: "203.0.113.9",
  userAgent: "test-agent",
});

test("the right email and password sign in and clear the attempt counter", async () => {
  const { deps, counts } = harness();
  counts.set("owner@example.com", 3);
  const result = await verifyCredentials(attempt("  Owner@Example.com ", "right-password"), deps);
  assert.deepEqual(result, { ok: true, user });
  assert.equal(counts.has("owner@example.com"), false);
});

test("wrong password, unknown email and disabled user give the same answer", async () => {
  const wrong = harness();
  const unknown = harness();
  const disabled = harness({ users: [{ ...user, disabledAt: new Date() }] });
  const results = [
    await verifyCredentials(attempt("owner@example.com", "nope"), wrong.deps),
    await verifyCredentials(attempt("ghost@example.com", "right-password"), unknown.deps),
    await verifyCredentials(attempt("owner@example.com", "right-password"), disabled.deps),
  ];
  for (const result of results) assert.deepEqual(result, { ok: false, reason: "invalid" });
});

test("an unknown email still runs one bcrypt comparison, against the dummy hash", async () => {
  const { deps, compared } = harness();
  await verifyCredentials(attempt("ghost@example.com", "whatever"), deps);
  assert.deepEqual(compared, [DUMMY_HASH]);
  const known = harness();
  await verifyCredentials(attempt("owner@example.com", "nope"), known.deps);
  assert.deepEqual(known.compared, [user.passwordHash]);
});

test("a disabled user is compared too, so timing does not reveal the state", async () => {
  const { deps, compared } = harness({ users: [{ ...user, disabledAt: new Date() }] });
  await verifyCredentials(attempt("owner@example.com", "right-password"), deps);
  assert.equal(compared.length, 1);
});

test("a failure is audited with a reason but without the password", async () => {
  const { deps, counts, audits } = harness();
  await verifyCredentials(attempt("owner@example.com", "nope"), deps);
  assert.equal(counts.get("owner@example.com"), 1);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "auth.login.failure");
  assert.deepEqual(audits[0].actor, { id: "u1", email: "owner@example.com" });
  assert.deepEqual(audits[0].meta, { reason: "bad_password" });
  assert.equal(JSON.stringify(audits).includes("nope"), false);
});

test("an email that matches no account is stored only as a fingerprint", async () => {
  const { deps, audits } = harness();
  await verifyCredentials(attempt("pasted-secret@example.com", "whatever"), deps);
  assert.equal(audits[0].actor, null);
  assert.equal(JSON.stringify(audits).includes("pasted-secret"), false);
  const meta = audits[0].meta as { reason: string; emailFingerprint: string };
  assert.equal(meta.reason, "unknown_user");
  assert.match(meta.emailFingerprint, /^[0-9a-f]{16}$/);
});

test("the sixth try in a window is limited even with the right password", async () => {
  const { deps, compared } = harness();
  for (let index = 0; index < 5; index += 1) {
    await verifyCredentials(attempt("owner@example.com", "nope"), deps);
  }
  const limited = await verifyCredentials(attempt("owner@example.com", "right-password"), deps);
  assert.deepEqual(limited, { ok: false, reason: "limited" });
  assert.equal(compared.length, 5, "no bcrypt work once the account is limited");
});

test("attempts running in parallel cannot exceed the limit", async () => {
  const { deps, compared } = harness();
  const results = await Promise.all(
    Array.from({ length: 12 }, () => verifyCredentials(attempt("owner@example.com", "nope"), deps))
  );
  assert.equal(compared.length, 5);
  assert.equal(results.filter((result) => !result.ok && result.reason === "limited").length, 7);
});

test("the start of an account lock is audited once, later refusals write nothing", async () => {
  const { deps, audits } = harness();
  for (let index = 0; index < 5; index += 1) {
    await verifyCredentials(attempt("owner@example.com", "nope"), deps);
  }
  const before = audits.length;
  for (let index = 0; index < 4; index += 1) {
    await verifyCredentials(attempt("owner@example.com", "nope"), deps);
  }
  assert.equal(audits.length, before + 1);
  assert.equal((audits[audits.length - 1].meta as { reason: string }).reason, "locked_account");
});

test("a limited IP is refused before anything else is read, and only logged", async () => {
  let looked = 0;
  const { deps, audits, warnings } = harness({
    allowIp: async () => false,
    findUser: async () => {
      looked += 1;
      return user;
    },
  });
  assert.deepEqual(await verifyCredentials(attempt("owner@example.com", "right-password"), deps), {
    ok: false,
    reason: "limited",
  });
  assert.equal(looked, 0);
  assert.equal(audits.length, 0);
  assert.equal(warnings.length, 1);
});

test("limiter errors fail closed", async () => {
  const ipDown = harness({
    allowIp: async () => {
      throw new Error("redis down");
    },
  });
  assert.equal((await verifyCredentials(attempt("owner@example.com", "right-password"), ipDown.deps)).ok, false);

  const counterDown = harness();
  counterDown.deps.failures.reserve = async () => {
    throw new Error("redis down");
  };
  assert.deepEqual(await verifyCredentials(attempt("owner@example.com", "right-password"), counterDown.deps), {
    ok: false,
    reason: "limited",
  });
});

test("malformed input is refused without touching the database", async () => {
  let looked = 0;
  const { deps } = harness({
    findUser: async () => {
      looked += 1;
      return user;
    },
  });
  for (const [email, password] of [
    [undefined, "x"],
    ["owner@example.com", undefined],
    ["", "x"],
    ["not-an-email", "x"],
    ["owner@example.com", ""],
    ["a".repeat(300) + "@example.com", "x"],
    ["owner@example.com", "p".repeat(2000)],
    [{ $ne: "" }, "x"],
  ] as const) {
    assert.deepEqual(await verifyCredentials(attempt(email, password), deps), { ok: false, reason: "invalid" });
  }
  assert.equal(looked, 0);
});

test("a right password for an MFA account is reported with mfaEnabled, and the counter is cleared", async () => {
  const mfaUser = { ...user, mfaEnabled: true };
  const { deps, counts } = harness({ users: [mfaUser] });
  counts.set("owner@example.com", 2);
  const result = await verifyCredentials(attempt("owner@example.com", "right-password"), deps);
  assert.deepEqual(result, { ok: true, user: mfaUser });
  assert.equal(counts.has("owner@example.com"), false);
});

test("a failing audit write does not change the answer", async () => {
  const { deps } = harness({
    audit: async () => {
      throw new Error("db down");
    },
  });
  assert.deepEqual(await verifyCredentials(attempt("owner@example.com", "nope"), deps), {
    ok: false,
    reason: "invalid",
  });
});
