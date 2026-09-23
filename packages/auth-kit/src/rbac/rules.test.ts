import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_GRANTS, PERMISSIONS, ROLES, type Permission, type RoleName } from "./permissions";
import {
  assignableRoles,
  can,
  canManage,
  defaultMatrix,
  diffMatrix,
  matrixFromRows,
  matrixToRows,
  validateMatrix,
} from "./rules";

// The table of docs/plan/admin-cms-adr.md, section 9, written out in full.
const MANAGER_DENIED: Permission[] = ["deleteUser", "manageSettings", "manageIpAllowlist", "clearSystemCache", "managePermissions"];
const EDITOR_ALLOWED: Permission[] = [
  "viewDashboard",
  "editPages",
  "editCollections",
  "viewBlog",
  "editBlog",
  "generateAI",
  "viewMedia",
  "uploadMedia",
];

test("full matrix: every role by every permission, from the seed defaults", () => {
  const matrix = defaultMatrix();
  for (const permission of PERMISSIONS) {
    assert.equal(can(matrix, "DEVELOPER", permission), true, `DEVELOPER ${permission}`);
    assert.equal(can(matrix, "MANAGER", permission), !MANAGER_DENIED.includes(permission), `MANAGER ${permission}`);
    assert.equal(can(matrix, "EDITOR", permission), EDITOR_ALLOWED.includes(permission), `EDITOR ${permission}`);
  }
});

test("an EDITOR holds no user, role, session or audit permission by default", () => {
  const matrix = defaultMatrix();
  for (const permission of [
    "viewUsers",
    "inviteUser",
    "manageUsers",
    "deleteUser",
    "resetPassword",
    "managePermissions",
    "viewSessions",
    "revokeSessions",
    "forceLogout",
    "viewAuditLogs",
    "exportData",
  ] as const) {
    assert.equal(can(matrix, "EDITOR", permission), false, permission);
  }
});

test("DEVELOPER keeps every permission even when the stored rows are empty or hostile", () => {
  const matrix = matrixFromRows([{ role: "DEVELOPER", permission: "viewDashboard" }]);
  for (const permission of PERMISSIONS) assert.equal(can(matrix, "DEVELOPER", permission), true);
  assert.equal(matrix.MANAGER.size, 0);
});

test("stored rows load; unknown roles and permissions and never-grantable ones are ignored", () => {
  const matrix = matrixFromRows([
    { role: "MANAGER", permission: "viewBlog" },
    { role: "MANAGER", permission: "managePermissions" },
    { role: "EDITOR", permission: "notAPermission" },
    { role: "ROOT", permission: "viewBlog" },
    { role: "EDITOR", permission: "viewMedia" },
  ]);
  assert.deepEqual([...matrix.MANAGER], ["viewBlog"]);
  assert.deepEqual([...matrix.EDITOR], ["viewMedia"]);
});

test("rows round trip through the matrix", () => {
  const matrix = defaultMatrix();
  const rebuilt = matrixFromRows(matrixToRows(matrix));
  for (const role of ROLES) assert.deepEqual([...rebuilt[role]].sort(), [...matrix[role]].sort());
  assert.equal(matrixToRows(matrix).length, DEFAULT_GRANTS.MANAGER.length + DEFAULT_GRANTS.EDITOR.length);
});

const person = (id: string, role: RoleName) => ({ id, role });

test("hierarchy: DEVELOPER manages others, MANAGER only EDITORs, EDITOR nobody, nobody themselves", () => {
  const dev = person("d1", "DEVELOPER");
  const mgr = person("m1", "MANAGER");
  const edt = person("e1", "EDITOR");
  assert.equal(canManage(dev, mgr), true);
  assert.equal(canManage(dev, edt), true);
  assert.equal(canManage(dev, person("d2", "DEVELOPER")), true);
  assert.equal(canManage(mgr, edt), true);
  assert.equal(canManage(mgr, person("m2", "MANAGER")), false);
  assert.equal(canManage(mgr, dev), false);
  assert.equal(canManage(edt, person("e2", "EDITOR")), false);
  for (const self of [dev, mgr, edt]) assert.equal(canManage(self, self), false, `${self.role} on self`);
});

test("assignable roles follow the same hierarchy", () => {
  assert.deepEqual(assignableRoles("DEVELOPER"), ["DEVELOPER", "MANAGER", "EDITOR"]);
  assert.deepEqual(assignableRoles("MANAGER"), ["EDITOR"]);
  assert.deepEqual(assignableRoles("EDITOR"), []);
});

test("a matrix that grants a DEVELOPER-only permission to another role is invalid", () => {
  const matrix = defaultMatrix();
  assert.deepEqual(validateMatrix(matrix), { ok: true });
  const bad = { ...matrix, MANAGER: new Set([...matrix.MANAGER, "managePermissions" as const]) };
  assert.equal(validateMatrix(bad).ok, false);
});

test("diffMatrix lists exactly what changed", () => {
  const before = defaultMatrix();
  const after = {
    ...before,
    EDITOR: new Set([...before.EDITOR, "viewLeads" as const].filter((permission) => permission !== "viewBlog")),
  };
  assert.deepEqual(diffMatrix(before, after), [
    { role: "EDITOR", permission: "viewBlog", granted: false },
    { role: "EDITOR", permission: "viewLeads", granted: true },
  ]);
  assert.deepEqual(diffMatrix(before, before), []);
});
