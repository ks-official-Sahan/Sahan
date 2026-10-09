import assert from "node:assert/strict";
import { test } from "node:test";

import { createMask, presentationModeOn } from "./mask";

type Role = "DEVELOPER" | "SUPER_ADMIN" | "EDITOR";
const policy = { superRole: "DEVELOPER", maskAs: "SUPER_ADMIN", enabled: true } as const;
const dev = { id: "d1", role: "DEVELOPER" as Role, email: "d@example.com" };
const dev2 = { id: "d2", role: "DEVELOPER" as Role };
const admin = { id: "a1", role: "SUPER_ADMIN" as Role };
const editor = { id: "e1", role: "EDITOR" as Role };

test("a masked developer is shown as SUPER_ADMIN to everyone but developers", () => {
  const mask = createMask<Role>(policy, { global: false, users: new Set(["d1"]) });
  assert.equal(mask.isMasked(dev), true);
  assert.equal(mask.isMasked(dev2), false);
  assert.equal(mask.roleFor(admin, dev), "SUPER_ADMIN");
  assert.equal(mask.roleFor(editor, dev2), "DEVELOPER", "an unmasked developer shows as one");
  assert.equal(mask.roleFor(dev2, dev), "DEVELOPER", "developers see through masks");
  assert.deepEqual(mask.present(admin, dev), { ...dev, role: "SUPER_ADMIN" });
  assert.equal(mask.present(dev2, dev), dev, "an unchanged person is returned as is");
  assert.equal(mask.isMasked({ id: "d1", role: "EDITOR" }), false, "only the super role is ever masked");
});

test("the global switch masks every developer", () => {
  const mask = createMask<Role>(policy, { global: true, users: new Set() });
  assert.equal(mask.roleFor(admin, dev2), "SUPER_ADMIN");
  assert.equal(mask.roleFor(dev, dev2), "DEVELOPER");
});

test("the developer role row hides once no developer is left unmasked, or globally", () => {
  const roles = [{ name: "DEVELOPER" }, { name: "SUPER_ADMIN" }, { name: "EDITOR" }];
  const partial = createMask<Role>(policy, { global: false, users: new Set(["d1"]) });
  assert.equal(partial.visibleRoles(admin, roles, 1).length, 3, "an unmasked developer still shows the row");
  assert.deepEqual(partial.visibleRoles(admin, roles, 0).map((r) => r.name), ["SUPER_ADMIN", "EDITOR"]);
  assert.equal(partial.visibleRoles(dev, roles, 0).length, 3);
  const global = createMask<Role>(policy, { global: true, users: new Set() });
  assert.deepEqual(global.visibleRoles(editor, roles, 5).map((r) => r.name), ["SUPER_ADMIN", "EDITOR"]);
});

test("user counts move masked developers to SUPER_ADMIN for non-developers", () => {
  const mask = createMask<Role>(policy, { global: false, users: new Set(["d1"]) });
  assert.deepEqual(mask.presentCounts(admin, { DEVELOPER: 2, SUPER_ADMIN: 1, EDITOR: 4 }, 1), { DEVELOPER: 1, SUPER_ADMIN: 2, EDITOR: 4 });
  assert.deepEqual(mask.presentCounts(admin, { DEVELOPER: 1, EDITOR: 4 }, 1), { SUPER_ADMIN: 1, EDITOR: 4 });
  assert.deepEqual(mask.presentCounts(dev, { DEVELOPER: 1 }, 1), { DEVELOPER: 1 });
});

test("audit rows written by a developer are for developers only, masked or not", () => {
  const mask = createMask<Role>(policy, { global: false, users: new Set() });
  assert.equal(mask.canSeeAuditBy(admin, "DEVELOPER"), false);
  assert.equal(mask.canSeeAuditBy(admin, "SUPER_ADMIN"), true);
  assert.equal(mask.canSeeAuditBy(admin, null), true);
  assert.equal(mask.canSeeAuditBy(dev, "DEVELOPER"), true);
});

test("masking is off unless the policy enables it, and stored flags are then ignored", () => {
  const roles = [{ name: "DEVELOPER" }, { name: "SUPER_ADMIN" }, { name: "EDITOR" }];
  for (const off of [createMask<Role>({ superRole: "DEVELOPER", maskAs: "SUPER_ADMIN" }, { global: true, users: new Set(["d1"]) }), createMask<Role>({ ...policy, enabled: false })]) {
    assert.equal(off.enabled, false);
    assert.equal(off.isMasked(dev), false);
    assert.equal(off.roleFor(admin, dev), "DEVELOPER");
    assert.equal(off.visibleRoles(admin, roles, 0).length, 3);
    assert.deepEqual(off.presentCounts(admin, { DEVELOPER: 1, EDITOR: 4 }, 1), { DEVELOPER: 1, EDITOR: 4 });
    assert.equal(off.canSeeAuditBy(admin, "DEVELOPER"), true);
    assert.equal(off.hiddenAuditRole(admin), undefined);
  }
  const on = createMask<Role>(policy);
  assert.equal(on.hiddenAuditRole(admin), "DEVELOPER");
  assert.equal(on.hiddenAuditRole(dev), undefined);
});

test("ADMIN_PRESENTATION_MODE turns masking on only for the exact value true", () => {
  for (const value of [undefined, null, "", "1", "yes", "on", "TRUE", "True", "false"]) assert.equal(presentationModeOn(value), false, String(value));
  assert.equal(presentationModeOn("true"), true);
  assert.equal(presentationModeOn(" true "), true);
});
