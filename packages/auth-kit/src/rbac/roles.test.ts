import assert from "node:assert/strict";
import { test } from "node:test";

import { checkRoleInput, createRoleCatalog, type RoleRecord } from "./roles";

const role = (name: string, rank: number, system = false): RoleRecord => ({ name, label: name, description: null, rank, system });
const ROLES = [role("EDITOR", 20, true), role("DEVELOPER", 0, true), role("SUPPORT", 30), role("MANAGER", 10, true)];
const catalog = createRoleCatalog(ROLES, "DEVELOPER");
const person = (id: string, role: string) => ({ id, role });

test("catalog: sorted by rank, looks roles up by name", () => {
  assert.deepEqual(catalog.names, ["DEVELOPER", "MANAGER", "EDITOR", "SUPPORT"]);
  assert.equal(catalog.has("SUPPORT"), true);
  assert.equal(catalog.has("GHOST"), false);
  assert.equal(catalog.get("MANAGER")?.rank, 10);
});

test("canManage: lower rank manages strictly higher; never yourself; unknown roles fail closed", () => {
  assert.equal(catalog.canManage(person("a", "DEVELOPER"), person("b", "DEVELOPER")), true);
  assert.equal(catalog.canManage(person("a", "DEVELOPER"), person("a", "DEVELOPER")), false);
  assert.equal(catalog.canManage(person("a", "MANAGER"), person("b", "SUPPORT")), true);
  assert.equal(catalog.canManage(person("a", "MANAGER"), person("b", "MANAGER")), false, "same rank");
  assert.equal(catalog.canManage(person("a", "SUPPORT"), person("b", "EDITOR")), false, "higher rank");
  assert.equal(catalog.canManage(person("a", "GHOST"), person("b", "SUPPORT")), false);
  assert.equal(catalog.canManage(person("a", "MANAGER"), person("b", "GHOST")), false);
});

test("assignable: every role for the super role, strictly lower ones for the rest", () => {
  assert.deepEqual(catalog.assignable("DEVELOPER"), ["DEVELOPER", "MANAGER", "EDITOR", "SUPPORT"]);
  assert.deepEqual(catalog.assignable("MANAGER"), ["EDITOR", "SUPPORT"]);
  assert.deepEqual(catalog.assignable("SUPPORT"), []);
  assert.deepEqual(catalog.assignable("GHOST"), []);
});

test("checkRoleInput: normalises the name, refuses clashes and bad ranks", () => {
  assert.deepEqual(checkRoleInput({ name: " support_2 ", label: " Support ", description: " ", rank: 25 }, ROLES), {
    ok: true,
    value: { name: "SUPPORT_2", label: "Support", description: null, rank: 25 },
  });
  assert.equal((checkRoleInput({ name: "support", label: "S", rank: 25 }, ROLES) as { field: string }).field, "name");
  assert.equal(checkRoleInput({ name: "SUPPORT", label: "S", rank: 25 }, ROLES, "SUPPORT").ok, true, "editing itself");
  assert.equal((checkRoleInput({ name: "1X", label: "S", rank: 25 }, ROLES) as { field: string }).field, "name");
  assert.equal((checkRoleInput({ name: "NEW", label: "", rank: 25 }, ROLES) as { field: string }).field, "label");
  for (const rank of [0, -1, 1.5, 1001]) {
    assert.equal((checkRoleInput({ name: "NEW", label: "N", rank }, ROLES) as { field: string }).field, "rank", String(rank));
  }
});
