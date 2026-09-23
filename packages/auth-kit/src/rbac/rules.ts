import type { PermissionRow } from "../adapter";
import {
  canBeGranted,
  defaultPermissionsFor,
  isPermission,
  isRole,
  NEVER_GRANTABLE,
  PERMISSIONS,
  ROLES,
  type Permission,
  type RoleName,
} from "./permissions";

export type { PermissionRow };

// The pure part of role-based access: what a role may do, and who may manage
// whom. No database and no cache here, so every rule is unit tested. The matrix
// itself is loaded and cached by lib/auth/rbac.ts (docs/plan/admin-cms-adr.md,
// sections 6.5 and 9).

export type Matrix = Record<RoleName, ReadonlySet<Permission>>;

/** DEVELOPER holds everything in code. The other roles come from the stored rows. */
export function matrixFromRows(rows: readonly PermissionRow[]): Matrix {
  const granted: Record<RoleName, Set<Permission>> = {
    DEVELOPER: new Set(PERMISSIONS),
    MANAGER: new Set(),
    EDITOR: new Set(),
  };
  for (const { role, permission } of rows) {
    if (role === "DEVELOPER" || !isRole(role) || !isPermission(permission)) continue;
    if (canBeGranted(role, permission)) granted[role].add(permission);
  }
  return granted;
}

export function defaultMatrix(): Matrix {
  return {
    DEVELOPER: new Set(PERMISSIONS),
    MANAGER: new Set(defaultPermissionsFor("MANAGER")),
    EDITOR: new Set(defaultPermissionsFor("EDITOR")),
  };
}

/** Rows to store: DEVELOPER needs none. */
export function matrixToRows(matrix: Matrix): Array<{ role: "MANAGER" | "EDITOR"; permission: Permission }> {
  const rows: Array<{ role: "MANAGER" | "EDITOR"; permission: Permission }> = [];
  for (const role of ["MANAGER", "EDITOR"] as const) {
    for (const permission of PERMISSIONS) {
      if (matrix[role].has(permission)) rows.push({ role, permission });
    }
  }
  return rows;
}

export function can(matrix: Matrix, role: RoleName, permission: Permission): boolean {
  return role === "DEVELOPER" || matrix[role].has(permission);
}

export interface Person {
  id: string;
  role: RoleName;
}

/** Nobody manages themselves. A DEVELOPER manages everyone else, a MANAGER only EDITORs. */
export function canManage(actor: Person, target: Person): boolean {
  if (actor.id === target.id) return false;
  if (actor.role === "DEVELOPER") return true;
  if (actor.role === "MANAGER") return target.role === "EDITOR";
  return false;
}

/** Roles the actor may give to another person. */
export function assignableRoles(actorRole: RoleName): RoleName[] {
  if (actorRole === "DEVELOPER") return [...ROLES];
  if (actorRole === "MANAGER") return ["EDITOR"];
  return [];
}

export interface MatrixChange {
  role: "MANAGER" | "EDITOR";
  permission: Permission;
  granted: boolean;
}

export function diffMatrix(before: Matrix, after: Matrix): MatrixChange[] {
  const changes: MatrixChange[] = [];
  for (const role of ["MANAGER", "EDITOR"] as const) {
    for (const permission of PERMISSIONS) {
      const was = before[role].has(permission);
      const now = after[role].has(permission);
      if (was !== now) changes.push({ role, permission, granted: now });
    }
  }
  return changes;
}

export type MatrixCheck = { ok: true } | { ok: false; error: string };

/** A proposed matrix may never grant a permission that only DEVELOPER can hold. */
export function validateMatrix(matrix: Matrix): MatrixCheck {
  for (const role of ["MANAGER", "EDITOR"] as const) {
    for (const permission of NEVER_GRANTABLE) {
      if (matrix[role].has(permission)) {
        return { ok: false, error: `${permission} cannot be granted to ${role}.` };
      }
    }
  }
  return { ok: true };
}
