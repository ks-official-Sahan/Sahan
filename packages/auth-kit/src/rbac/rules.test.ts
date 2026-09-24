import assert from "node:assert/strict";
import { test } from "node:test";

import { defineAuthKit } from "../kit";
import { can, defaultMatrix, diffMatrix, matrixFromRows, matrixToRows, validateMatrix } from "./rules";

// Same small synthetic catalogue as permissions.test.ts, plus a custom
// 3-tier `canManage`/`assignableRoles` override (the shape a real app, like
// this package's own Sahan origin, actually configures) to prove those are
// genuinely pluggable and not hardcoded anywhere in the engine.
const ROLES = ["OWNER", "MANAGER", "STAFF"] as const;
const PERMISSIONS = ["viewBilling", "manageBilling", "viewOrders", "manageOrders", "manageUsers"] as const;

const kit = defineAuthKit({
  cookies: { session: "s", unlock: "u" },
  keyPrefix: "test:",
  roles: ROLES,
  superRole: "OWNER",
  permissions: PERMISSIONS,
  neverGrantable: ["manageUsers"],
  defaultGrants: {
    MANAGER: ["viewBilling", "viewOrders", "manageOrders"],
    STAFF: ["viewOrders"],
  },
  canManage: (actor, target) => {
    if (actor.id === target.id) return false;
    if (actor.role === "OWNER") return true;
    if (actor.role === "MANAGER") return target.role === "STAFF";
    return false;
  },
  assignableRoles: (actorRole) => {
    if (actorRole === "OWNER") return [...ROLES];
    if (actorRole === "MANAGER") return ["STAFF"];
    return [];
  },
  limits: {},
});

test("defaultMatrix: every role by every permission, from the configured defaults", () => {
  const matrix = defaultMatrix(kit);
  for (const permission of PERMISSIONS) assert.equal(can(kit, matrix, "OWNER", permission), true, `OWNER ${permission}`);
  assert.deepEqual([...matrix.MANAGER].sort(), ["manageOrders", "viewBilling", "viewOrders"]);
  assert.deepEqual([...matrix.STAFF], ["viewOrders"]);
});

test("the super role holds everything even when the stored rows are empty or hostile", () => {
  const matrix = matrixFromRows(kit, [{ role: "OWNER", permission: "viewBilling" }]);
  for (const permission of PERMISSIONS) assert.equal(can(kit, matrix, "OWNER", permission), true);
  assert.equal(matrix.MANAGER.size, 0);
});

test("stored rows load; unknown roles/permissions and never-grantable ones are ignored", () => {
  const matrix = matrixFromRows(kit, [
    { role: "MANAGER", permission: "viewOrders" },
    { role: "MANAGER", permission: "manageUsers" }, // never-grantable
    { role: "STAFF", permission: "notAPermission" },
    { role: "ROOT", permission: "viewOrders" }, // unknown role
    { role: "STAFF", permission: "viewBilling" },
  ]);
  assert.deepEqual([...matrix.MANAGER], ["viewOrders"]);
  assert.deepEqual([...matrix.STAFF], ["viewBilling"]);
});

test("rows round trip through the matrix", () => {
  const matrix = defaultMatrix(kit);
  const rebuilt = matrixFromRows(kit, matrixToRows(kit, matrix));
  for (const role of ROLES) assert.deepEqual([...rebuilt[role]].sort(), [...matrix[role]].sort());
});

test("matrixToRows writes nothing for the super role", () => {
  const matrix = defaultMatrix(kit);
  assert.equal(matrixToRows(kit, matrix).some((row) => row.role === "OWNER"), false);
});

const person = (id: string, role: (typeof ROLES)[number]) => ({ id, role });

test("the app's canManage hierarchy is used as configured, not hardcoded by the engine", () => {
  const owner = person("o1", "OWNER");
  const manager = person("m1", "MANAGER");
  const staff = person("s1", "STAFF");
  assert.equal(kit.canManage(owner, manager), true);
  assert.equal(kit.canManage(manager, staff), true);
  assert.equal(kit.canManage(manager, person("m2", "MANAGER")), false);
  assert.equal(kit.canManage(staff, person("s2", "STAFF")), false);
  for (const self of [owner, manager, staff]) assert.equal(kit.canManage(self, self), false, `${self.role} on self`);
});

test("assignableRoles follows the configured hierarchy", () => {
  assert.deepEqual(kit.assignableRoles("OWNER"), ["OWNER", "MANAGER", "STAFF"]);
  assert.deepEqual(kit.assignableRoles("MANAGER"), ["STAFF"]);
  assert.deepEqual(kit.assignableRoles("STAFF"), []);
});

test("defineAuthKit's default canManage/assignableRoles, when the app does not override them, only let the super role manage others", () => {
  const generic = defineAuthKit({
    cookies: { session: "s", unlock: "u" },
    keyPrefix: "test:",
    roles: ROLES,
    superRole: "OWNER",
    permissions: PERMISSIONS,
    defaultGrants: {},
    limits: {},
  });
  const owner = person("o1", "OWNER");
  const manager = person("m1", "MANAGER");
  assert.equal(generic.canManage(owner, manager), true);
  assert.equal(generic.canManage(manager, person("s1", "STAFF")), false);
  assert.equal(generic.canManage(owner, owner), false);
  assert.deepEqual(generic.assignableRoles("OWNER"), [...ROLES]);
  assert.deepEqual(generic.assignableRoles("MANAGER"), []);
});

test("a matrix that grants a super-role-only permission to another role is invalid", () => {
  const matrix = defaultMatrix(kit);
  assert.deepEqual(validateMatrix(kit, matrix), { ok: true });
  const bad = { ...matrix, MANAGER: new Set([...matrix.MANAGER, "manageUsers" as const]) };
  assert.equal(validateMatrix(kit, bad).ok, false);
});

test("diffMatrix lists exactly what changed, and never mentions the super role", () => {
  const before = defaultMatrix(kit);
  const after = {
    ...before,
    STAFF: new Set([...before.STAFF, "manageOrders" as const]),
  };
  assert.deepEqual(diffMatrix(kit, before, after), [{ role: "STAFF", permission: "manageOrders", granted: true }]);
  assert.deepEqual(diffMatrix(kit, before, before), []);
});
