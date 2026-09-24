import assert from "node:assert/strict";
import { test } from "node:test";

import { defineAuthKit } from "../kit";
import { canBeGranted, defaultPermissionsFor, isPermission, isRole } from "./permissions";

// A small synthetic catalogue standing in for an app's own (the package ships
// no roles or permissions of its own; see kit.ts / defineAuthKit for where an
// app's real catalogue lives, and ../../lib/auth/kit.ts in the app this
// package was extracted from for a full worked example).
const ROLES = ["OWNER", "STAFF"] as const;
const PERMISSIONS = ["viewBilling", "manageBilling", "viewOrders", "manageOrders"] as const;

const kit = defineAuthKit({
  cookies: { session: "s", unlock: "u" },
  keyPrefix: "test:",
  roles: ROLES,
  superRole: "OWNER",
  permissions: PERMISSIONS,
  neverGrantable: ["manageBilling"],
  defaultGrants: { STAFF: ["viewOrders", "manageOrders"] },
  limits: {},
});

test("OWNER (the super role) defaults to every permission", () => {
  assert.deepEqual(defaultPermissionsFor(kit, "OWNER"), [...PERMISSIONS]);
});

test("a non-super role defaults to exactly its configured grants", () => {
  assert.deepEqual(defaultPermissionsFor(kit, "STAFF"), ["viewOrders", "manageOrders"]);
});

test("a role with no configured defaults gets none", () => {
  const bare = defineAuthKit({
    cookies: { session: "s", unlock: "u" },
    keyPrefix: "test:",
    roles: ["OWNER", "GUEST"] as const,
    superRole: "OWNER",
    permissions: PERMISSIONS,
    defaultGrants: {},
    limits: {},
  });
  assert.deepEqual(defaultPermissionsFor(bare, "GUEST"), []);
});

test("never-grantable permissions cannot be granted to anyone but the super role", () => {
  assert.equal(canBeGranted(kit, "STAFF", "manageBilling"), false);
  assert.equal(canBeGranted(kit, "OWNER", "manageBilling"), true);
  assert.equal(canBeGranted(kit, "STAFF", "viewOrders"), true);
});

test("isPermission and isRole guard unknown input against the configured catalogue", () => {
  assert.equal(isPermission(kit, "viewOrders"), true);
  assert.equal(isPermission(kit, "vieworders"), false);
  assert.equal(isPermission(kit, "__proto__"), false);
  assert.equal(isRole(kit, "STAFF"), true);
  assert.equal(isRole(kit, "ADMIN"), false);
});
