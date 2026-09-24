import type { PermissionRow } from "../adapter";
import type { ResolvedAuthKit } from "../kit";
import { canBeGranted, defaultPermissionsFor, isPermission, isRole } from "./permissions";

export type { PermissionRow };

// The pure part of role-based access: what a role may do. No database and no
// cache here, so every rule is unit tested. The matrix itself is loaded and
// cached by rbac.ts. Generic over the app's own role/permission catalogue
// (see ../kit.ts's `defineAuthKit`); `canManage`/`assignableRoles` (who may
// manage whom) are app policy and live on the resolved kit itself, not here.

export type Matrix<TRole extends string, TPermission extends string> = Record<TRole, ReadonlySet<TPermission>>;

type RulesKit<TRole extends string, TPermission extends string> = Pick<
  ResolvedAuthKit<TRole, TPermission>,
  "roles" | "permissions" | "superRole" | "neverGrantable" | "defaultGrants"
>;

/** The super role holds everything in code. The other roles come from the stored rows. */
export function matrixFromRows<TRole extends string, TPermission extends string>(
  kit: RulesKit<TRole, TPermission>,
  rows: readonly PermissionRow[]
): Matrix<TRole, TPermission> {
  const granted = Object.fromEntries(
    kit.roles.map((role) => [role, role === kit.superRole ? new Set<TPermission>(kit.permissions) : new Set<TPermission>()])
  ) as Record<TRole, Set<TPermission>>;

  for (const { role, permission } of rows) {
    if (role === kit.superRole || !isRole(kit, role) || !isPermission(kit, permission)) continue;
    if (canBeGranted(kit, role, permission)) granted[role].add(permission);
  }
  return granted;
}

export function defaultMatrix<TRole extends string, TPermission extends string>(kit: RulesKit<TRole, TPermission>): Matrix<TRole, TPermission> {
  return Object.fromEntries(kit.roles.map((role) => [role, new Set(defaultPermissionsFor(kit, role))])) as Record<
    TRole,
    Set<TPermission>
  >;
}

/** Rows to store: the super role needs none. */
export function matrixToRows<TRole extends string, TPermission extends string>(
  kit: Pick<RulesKit<TRole, TPermission>, "roles" | "permissions" | "superRole">,
  matrix: Matrix<TRole, TPermission>
): Array<{ role: TRole; permission: TPermission }> {
  const rows: Array<{ role: TRole; permission: TPermission }> = [];
  for (const role of kit.roles) {
    if (role === kit.superRole) continue;
    for (const permission of kit.permissions) {
      if (matrix[role].has(permission)) rows.push({ role, permission });
    }
  }
  return rows;
}

export function can<TRole extends string, TPermission extends string>(
  kit: Pick<RulesKit<TRole, TPermission>, "superRole">,
  matrix: Matrix<TRole, TPermission>,
  role: TRole,
  permission: TPermission
): boolean {
  return role === kit.superRole || matrix[role].has(permission);
}

export interface MatrixChange<TRole extends string, TPermission extends string> {
  role: TRole;
  permission: TPermission;
  granted: boolean;
}

export function diffMatrix<TRole extends string, TPermission extends string>(
  kit: Pick<RulesKit<TRole, TPermission>, "roles" | "permissions" | "superRole">,
  before: Matrix<TRole, TPermission>,
  after: Matrix<TRole, TPermission>
): MatrixChange<TRole, TPermission>[] {
  const changes: MatrixChange<TRole, TPermission>[] = [];
  for (const role of kit.roles) {
    if (role === kit.superRole) continue;
    for (const permission of kit.permissions) {
      const was = before[role].has(permission);
      const now = after[role].has(permission);
      if (was !== now) changes.push({ role, permission, granted: now });
    }
  }
  return changes;
}

export type MatrixCheck = { ok: true } | { ok: false; error: string };

/** A proposed matrix may never grant a permission that only the super role can hold. */
export function validateMatrix<TRole extends string, TPermission extends string>(
  kit: Pick<RulesKit<TRole, TPermission>, "roles" | "superRole" | "neverGrantable">,
  matrix: Matrix<TRole, TPermission>
): MatrixCheck {
  for (const role of kit.roles) {
    if (role === kit.superRole) continue;
    for (const permission of kit.neverGrantable) {
      if (matrix[role].has(permission)) {
        return { ok: false, error: `${permission} cannot be granted to ${role}.` };
      }
    }
  }
  return { ok: true };
}
