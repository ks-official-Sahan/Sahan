import { cache } from "react";

import type { AuthDbAdapter } from "../adapter";
import type { AuditEvent } from "../audit-event";
import type { Kv } from "../cache/memory";
import type { ResolvedAuthKit } from "../kit";
import { isPermission } from "./permissions";
import { can as canWith, defaultMatrix, matrixFromRows, matrixToRows, type Matrix, type PermissionRow } from "./rules";

// The role by permission matrix, from the database with a 60 second Redis
// copy (key `${kit.keyPrefix}rbac:v1`, dropped whenever the matrix is saved).
// The super role always holds every permission in code, so a bad edit can
// never lock the owner out.

const TTL_SECONDS = 60;

export function createRbac<TRole extends string, TPermission extends string>(deps: {
  adapter: AuthDbAdapter;
  kv: Kv;
  kit: Pick<ResolvedAuthKit<TRole, TPermission>, "roles" | "permissions" | "superRole" | "neverGrantable" | "defaultGrants" | "keyPrefix">;
  /** Runs the app's real audit() inside the same transaction the adapter opened. */
  writeAudit: (event: AuditEvent, tx: unknown) => Promise<void>;
}) {
  const { adapter, kv, kit, writeAudit } = deps;
  const key = `${kit.keyPrefix}rbac:v1`;
  const editableRoles = kit.roles.filter((role) => role !== kit.superRole);

  async function readRows(): Promise<PermissionRow[]> {
    try {
      const cached = await kv.get<PermissionRow[]>(key);
      if (Array.isArray(cached)) return cached;
    } catch {
      // Redis down: read the database.
    }
    const rows = await adapter.findAllRolePermissions();
    await kv.set(key, rows, { ttlSeconds: TTL_SECONDS }).catch(() => undefined);
    return rows;
  }

  /** One read per request. A database with no rows at all has not been seeded: use the defaults. */
  const loadMatrix = cache(async (): Promise<Matrix<TRole, TPermission>> => {
    const rows = await readRows();
    return rows.length === 0 ? defaultMatrix(kit) : matrixFromRows(kit, rows);
  });

  async function invalidateMatrix(): Promise<void> {
    await kv.del(key).catch(() => undefined);
  }

  const getRolePermissions = cache(async (role: TRole): Promise<readonly TPermission[]> => {
    if (role === kit.superRole) return kit.permissions;
    const matrix = await loadMatrix();
    return kit.permissions.filter((permission) => matrix[role].has(permission));
  });

  async function roleCan(role: TRole, permission: TPermission): Promise<boolean> {
    return canWith(kit, await loadMatrix(), role, permission);
  }

  /**
   * Replaces every editable role's rows (every role but the super role) and
   * writes the audit row in the same transaction. The caller checks the
   * permission. An empty matrix is stored as no rows, which reads back as the
   * defaults (see loadMatrix).
   */
  async function replaceMatrix(matrix: Matrix<TRole, TPermission>, updatedById: string, event: AuditEvent): Promise<void> {
    const rows = matrixToRows(kit, matrix).filter((row) => isPermission(kit, row.permission));
    await adapter.withTransaction(async (tx) => {
      await adapter.deleteRolePermissions(editableRoles, tx);
      if (rows.length > 0) await adapter.createRolePermissions(rows.map((row) => ({ ...row, updatedById })), tx);
      await writeAudit(event, tx);
    });
    await invalidateMatrix();
  }

  return { loadMatrix, invalidateMatrix, getRolePermissions, roleCan, replaceMatrix };
}
