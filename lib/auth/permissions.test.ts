import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_GRANTS,
  NEVER_GRANTABLE,
  PERMISSION_INFO,
  PERMISSIONS,
  canBeGranted,
  defaultPermissionsFor,
  isPermission,
  isRole,
} from "./permissions";

test("the catalogue has 33 unique keys and each one is described", () => {
  assert.equal(PERMISSIONS.length, 33);
  assert.equal(new Set(PERMISSIONS).size, PERMISSIONS.length);
  for (const key of PERMISSIONS) {
    const info = PERMISSION_INFO[key];
    assert.ok(info, `${key} has no info`);
    assert.ok(info.label.length > 0 && info.description.length > 0, `${key} is not described`);
  }
  assert.deepEqual(
    Object.keys(PERMISSION_INFO).sort(),
    [...PERMISSIONS].sort(),
    "PERMISSION_INFO and PERMISSIONS must list the same keys"
  );
});

test("DEVELOPER defaults to every permission", () => {
  assert.deepEqual(defaultPermissionsFor("DEVELOPER"), [...PERMISSIONS]);
});

test("MANAGER defaults match the design table", () => {
  const manager = new Set(DEFAULT_GRANTS.MANAGER);
  assert.equal(manager.size, 28);
  for (const denied of ["deleteUser", "manageSettings", "manageIpAllowlist", "clearSystemCache", "managePermissions"] as const) {
    assert.equal(manager.has(denied), false, `MANAGER must not default to ${denied}`);
  }
  for (const granted of ["publishPages", "publishBlog", "viewLeads", "manageChatbot", "forceLogout", "manageCron", "exportData"] as const) {
    assert.equal(manager.has(granted), true, `MANAGER should default to ${granted}`);
  }
});

test("EDITOR defaults are the eight drafting permissions", () => {
  assert.deepEqual([...DEFAULT_GRANTS.EDITOR].sort(), [
    "editBlog",
    "editCollections",
    "editPages",
    "generateAI",
    "uploadMedia",
    "viewBlog",
    "viewDashboard",
    "viewMedia",
  ]);
});

test("EDITOR is a subset of MANAGER", () => {
  const manager = new Set(DEFAULT_GRANTS.MANAGER);
  for (const permission of DEFAULT_GRANTS.EDITOR) {
    assert.ok(manager.has(permission), `${permission} is an EDITOR default but not a MANAGER default`);
  }
});

test("no default grants a never-grantable permission to another role", () => {
  for (const role of ["MANAGER", "EDITOR"] as const) {
    for (const permission of NEVER_GRANTABLE) {
      assert.equal(DEFAULT_GRANTS[role].includes(permission), false);
      assert.equal(canBeGranted(role, permission), false);
    }
  }
  assert.equal(canBeGranted("DEVELOPER", "managePermissions"), true);
  assert.equal(canBeGranted("MANAGER", "publishPages"), true);
});

test("isPermission and isRole guard unknown input", () => {
  assert.equal(isPermission("editPages"), true);
  assert.equal(isPermission("editpages"), false);
  assert.equal(isPermission("__proto__"), false);
  assert.equal(isRole("EDITOR"), true);
  assert.equal(isRole("ADMIN"), false);
});
