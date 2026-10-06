import assert from "node:assert/strict";
import { test } from "node:test";

import { can, defaultMatrix } from "@sahan-sac/auth-kit/rbac/rules";

import { usePermission } from "./hooks";
import { permissionCheck, roleOf } from "./permissions";

type Role = "OWNER" | "EDITOR";
type Permission = "posts.read" | "posts.write" | "users.manage";
const roles: readonly Role[] = ["OWNER", "EDITOR"];
const kit = {
  roles,
  permissions: ["posts.read", "posts.write", "users.manage"] as readonly Permission[],
  superRole: "OWNER" as Role,
  neverGrantable: ["users.manage"] as readonly Permission[],
  defaultGrants: { EDITOR: ["posts.read"] } as Partial<Record<Role, readonly Permission[]>>,
};
const isRole = (role: string): role is Role => (roles as readonly string[]).includes(role);

test("permissionCheck applies auth-kit's RBAC rules on the client", () => {
  const matrix = defaultMatrix(kit);
  const allowed = permissionCheck<Permission>((role, p) => isRole(role) && can(kit, matrix, role, p));
  assert.equal(allowed({ role: "EDITOR" }, "posts.read"), true);
  assert.equal(allowed({ role: "EDITOR" }, "posts.write"), false);
  assert.equal(allowed({ role: "OWNER" }, "users.manage"), true, "the super role holds everything");
  assert.equal(allowed({ role: "HACKER" }, "posts.read"), false, "an unknown role holds nothing");
  assert.equal(allowed(null, "posts.read"), false, "signed out");
  assert.equal(roleOf({ role: null }), "EDITOR");
  assert.equal(roleOf(undefined, "VIEWER"), "VIEWER");
});

test("usePermission is false while loading or signed out", () => {
  const user = { id: "u", email: "u@example.com", role: "DEVELOPER" };
  const client = (data: { user: typeof user } | null, isPending = false) => ({ useSession: () => ({ data, isPending }) });
  assert.deepEqual(usePermission(client(null, true)), { allowed: false, isPending: true, user: null });
  assert.deepEqual(usePermission(client(null)), { allowed: false, isPending: false, user: null });
  assert.equal(usePermission(client({ user }), (u) => u.role === "DEVELOPER").allowed, true);
  assert.equal(usePermission(client({ user }), (u) => u.role === "EDITOR").allowed, false);
});
