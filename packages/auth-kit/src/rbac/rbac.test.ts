import assert from "node:assert/strict";
import { test } from "node:test";

import { MemoryKv } from "../cache/memory";
import { defineAuthKit } from "../kit";
import { FakeAdapter } from "../test-support/fake-adapter";
import { createRbac } from "./rbac";

const ROLES = ["OWNER", "MANAGER", "STAFF"] as const;
const PERMISSIONS = ["viewBilling", "manageBilling", "viewOrders", "manageOrders", "manageUsers"] as const;

function harness() {
  const adapter = new FakeAdapter();
  const kv = new MemoryKv();
  const kit = defineAuthKit({
    cookies: { session: "s", unlock: "u" },
    keyPrefix: "test:",
    roles: ROLES,
    superRole: "OWNER",
    permissions: PERMISSIONS,
    neverGrantable: ["manageUsers"],
    defaultGrants: { MANAGER: ["viewBilling", "viewOrders", "manageOrders"], STAFF: ["viewOrders"] },
    limits: {},
  });
  const audits: Array<{ event: { action: string }; tx: unknown }> = [];
  const rbac = createRbac({ adapter, kv, kit, writeAudit: async (event, tx) => void audits.push({ event, tx }) });
  return { adapter, kv, kit, rbac, audits };
}

test("an unseeded database (no rows at all) reads back as the configured defaults", async () => {
  const { rbac } = harness();
  const matrix = await rbac.loadMatrix();
  assert.deepEqual([...matrix.MANAGER].sort(), ["manageOrders", "viewBilling", "viewOrders"]);
  assert.deepEqual([...matrix.STAFF], ["viewOrders"]);
  assert.equal(await rbac.roleCan("MANAGER", "viewBilling"), true);
  assert.equal(await rbac.roleCan("STAFF", "manageBilling"), false);
});

test("the super role can do everything regardless of stored rows", async () => {
  const { rbac } = harness();
  for (const permission of PERMISSIONS) assert.equal(await rbac.roleCan("OWNER", permission), true, permission);
  assert.deepEqual([...(await rbac.getRolePermissions("OWNER"))].sort(), [...PERMISSIONS].sort());
});

test("getRolePermissions for a non-super role reflects the loaded matrix", async () => {
  const { rbac } = harness();
  assert.deepEqual([...(await rbac.getRolePermissions("STAFF"))], ["viewOrders"]);
});

test("replaceMatrix writes rows, an audit row, and invalidates the cache, all as one transaction", async () => {
  const { adapter, rbac, audits } = harness();
  await rbac.loadMatrix(); // warm the cache with the defaults

  const next = { OWNER: new Set(PERMISSIONS), MANAGER: new Set(["viewBilling"] as const), STAFF: new Set([] as const) };
  await rbac.replaceMatrix(next, "actor-1", { action: "rbac.matrix.updated", entityType: "RolePermission" });

  const rows = await adapter.findAllRolePermissions();
  assert.deepEqual(
    rows.map((r) => `${r.role}:${r.permission}`).sort(),
    ["MANAGER:viewBilling"]
  );
  assert.equal(audits.length, 1);
  assert.equal(audits[0].event.action, "rbac.matrix.updated");

  const reloaded = await rbac.loadMatrix();
  assert.deepEqual([...reloaded.MANAGER], ["viewBilling"]);
});

test("replaceMatrix never writes a row for the super role", async () => {
  const { adapter, rbac } = harness();
  const next = { OWNER: new Set(["manageUsers"] as const), MANAGER: new Set([] as const), STAFF: new Set([] as const) };
  await rbac.replaceMatrix(next, "actor-1", { action: "rbac.matrix.updated", entityType: "RolePermission" });
  assert.equal((await adapter.findAllRolePermissions()).length, 0);
});

test("replaceMatrix silently drops a permission outside the catalogue (defense in depth)", async () => {
  const { adapter, rbac } = harness();
  const next = {
    OWNER: new Set(PERMISSIONS),
    MANAGER: new Set(["viewBilling", "totallyMadeUp"] as unknown as Set<(typeof PERMISSIONS)[number]>),
    STAFF: new Set([] as const),
  };
  await rbac.replaceMatrix(next as never, "actor-1", { action: "x", entityType: "RolePermission" });
  const rows = await adapter.findAllRolePermissions();
  assert.deepEqual(
    rows.map((r) => r.permission),
    ["viewBilling"]
  );
});

test("invalidateMatrix drops the Redis-shaped cache so the next read hits the database", async () => {
  const { adapter, kv, rbac } = harness();
  await rbac.loadMatrix();
  adapter.setRolePermissions([{ role: "STAFF", permission: "manageOrders" }]);
  // Cache is still warm from the first load (60s TTL), so nothing changed yet.
  assert.equal(await kv.get("test:rbac:v1") === null, false);
  await rbac.invalidateMatrix();
  assert.equal(await kv.get("test:rbac:v1"), null);
});

test("a Redis outage falls back to the database read", async () => {
  const adapter = new FakeAdapter();
  const kit = defineAuthKit({
    cookies: { session: "s", unlock: "u" },
    keyPrefix: "test:",
    roles: ROLES,
    superRole: "OWNER",
    permissions: PERMISSIONS,
    defaultGrants: { STAFF: ["viewOrders"] },
    limits: {},
  });
  adapter.setRolePermissions([{ role: "STAFF", permission: "manageOrders" }]);
  const brokenKv = {
    get: async () => {
      throw new Error("redis down");
    },
    set: async () => {
      throw new Error("redis down");
    },
    del: async () => 0,
    incr: async () => 1,
    expire: async () => false,
  };
  const rbac = createRbac({ adapter, kv: brokenKv, kit, writeAudit: async () => undefined });
  assert.deepEqual([...(await rbac.loadMatrix()).STAFF], ["manageOrders"]);
});
