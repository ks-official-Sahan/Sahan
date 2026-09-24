import assert from "node:assert/strict";
import { test } from "node:test";

import { createAuthDal, type AuthDalDeps } from "./dal";
import type { SessionState } from "./state";

const EXPIRE_PATH = "/api/auth/expire";
const ACCOUNT_PASSWORD_PATH = "/admin/account";

const live: SessionState = {
  userId: "u1",
  email: "owner@example.com",
  name: "Owner",
  role: "DEVELOPER",
  disabled: false,
  revoked: false,
  expiresAt: Date.now() + 60_000,
  pwf: "0123456789abcdef",
  mustChangePassword: false,
  mfaEnabled: false,
  mfaVerified: false,
};

class Redirected extends Error {
  constructor(public path: string) {
    super(`redirect:${path}`);
  }
}
class NotFound extends Error {
  constructor() {
    super("not-found");
  }
}

function harness(options: { session?: { sid?: string; user?: { id?: string }; pwf?: string } | null; state?: SessionState | null; permissions?: string[] } = {}) {
  const touched: string[] = [];
  const deps: AuthDalDeps = {
    auth: async () => (options.session === undefined ? { sid: "s1", user: { id: "u1" }, pwf: live.pwf } : options.session),
    getSessionState: async (sid) => (sid === "s1" ? (options.state === undefined ? live : options.state) : null),
    touchSession: async (sid) => void touched.push(sid),
    getRolePermissions: async () => options.permissions ?? ["viewDashboard"],
    notFound: () => {
      throw new NotFound();
    },
    redirect: (path) => {
      throw new Redirected(path);
    },
    after: (fn) => fn(),
    expirePath: EXPIRE_PATH,
    accountPasswordChangePath: ACCOUNT_PASSWORD_PATH,
  };
  return { dal: createAuthDal(deps), touched };
}

test("getOptionalUser returns the user for a live session and never throws", async () => {
  const { dal } = harness();
  const user = await dal.getOptionalUser();
  assert.equal(user?.id, "u1");
  assert.equal(user?.email, "owner@example.com");
  assert.deepEqual(user?.permissions, ["viewDashboard"]);
});

test("getOptionalUser is null with no session, and does not throw", async () => {
  const { dal } = harness({ session: null });
  assert.equal(await dal.getOptionalUser(), null);
});

test("requireUser returns the user for a live session and touches it (after())", async () => {
  const { dal, touched } = harness();
  const user = await dal.requireUser();
  assert.equal(user.id, "u1");
  assert.deepEqual(touched, ["s1"]);
});

test("requireUser calls notFound() when there is no session at all", async () => {
  const { dal } = harness({ session: null });
  await assert.rejects(dal.requireUser(), NotFound);
});

test("requireUser redirects to expirePath when the session no longer counts (revoked/expired/disabled/password-changed)", async () => {
  for (const state of [
    { ...live, revoked: true },
    { ...live, expiresAt: Date.now() - 1 },
    { ...live, disabled: true },
    { ...live, pwf: "different-fingerprint" },
  ]) {
    const { dal } = harness({ state });
    await assert.rejects(dal.requireUser(), (error: unknown) => error instanceof Redirected && error.path === EXPIRE_PATH);
  }
});

test("requireUser redirects to expirePath when the session row is simply missing", async () => {
  const { dal } = harness({ state: null });
  await assert.rejects(dal.requireUser(), (error: unknown) => error instanceof Redirected && error.path === EXPIRE_PATH);
});

test("requireUser redirects to the account page when the password must be changed, unless allowed", async () => {
  const { dal } = harness({ state: { ...live, mustChangePassword: true } });
  await assert.rejects(dal.requireUser(), (error: unknown) => error instanceof Redirected && error.path === ACCOUNT_PASSWORD_PATH);
});

test("requireUser({ allowPasswordChange: true }) lets a must-change-password user through", async () => {
  const { dal } = harness({ state: { ...live, mustChangePassword: true } });
  const user = await dal.requireUser({ allowPasswordChange: true });
  assert.equal(user.id, "u1");
});

test("getSessionStatus never throws, and reports why an inactive session is inactive", async () => {
  const { dal } = harness();
  assert.deepEqual(await dal.getSessionStatus(), { active: true });

  const revoked = harness({ state: { ...live, revoked: true } });
  assert.deepEqual(await revoked.dal.getSessionStatus(), { active: false, reason: "revoked" });

  const none = harness({ session: null });
  assert.deepEqual(await none.dal.getSessionStatus(), { active: false, reason: "no_session" });
});

test("hasPermission checks the resolved permission list", () => {
  const { dal } = harness();
  assert.equal(dal.hasPermission({ permissions: ["viewDashboard", "editBlog"] }, "editBlog"), true);
  assert.equal(dal.hasPermission({ permissions: ["viewDashboard"] }, "editBlog"), false);
});

test("requirePermission returns the user when they hold the permission", async () => {
  const { dal } = harness({ permissions: ["viewDashboard", "editBlog"] });
  const user = await dal.requirePermission("editBlog");
  assert.equal(user.id, "u1");
});

test("requirePermission calls notFound() when the user does not hold the permission (never 403)", async () => {
  const { dal } = harness({ permissions: ["viewDashboard"] });
  await assert.rejects(dal.requirePermission("deleteUser"), NotFound);
});

test("a user for another subject than the token claims is treated as no valid session", async () => {
  const { dal } = harness({ session: { sid: "s1", user: { id: "someone-else" }, pwf: live.pwf } });
  await assert.rejects(dal.requireUser(), (error: unknown) => error instanceof Redirected && error.path === EXPIRE_PATH);
});
