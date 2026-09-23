import { cache } from "react";

import type { AuthDbAdapter, RoleName } from "../adapter";
import type { AuditEvent } from "../audit-event";
import type { Kv } from "../cache/memory";
import { isPermission, PERMISSIONS, type Permission } from "./permissions";
import { can as canWith, defaultMatrix, matrixFromRows, matrixToRows, type Matrix, type PermissionRow } from "./rules";

// The role by permission matrix, from Postgres with a 60 second Redis copy
// (key sahan:rbac:v1, dropped whenever the matrix is saved). DEVELOPER always
// holds every permission in code, so a bad edit can never lock the owner out.
// docs/plan/admin-cms-adr.md, sections 6.5 and 9.

const KEY = "rbac:v1";
const TTL_SECONDS = 60;

export function createRbac(deps: {
  adapter: AuthDbAdapter;
  kv: Kv;
  /** Runs the app's real audit() inside the same transaction the adapter opened. */
  writeAudit: (event: AuditEvent, tx: unknown) => Promise<void>;
}) {
  const { adapter, kv, writeAudit } = deps;

  async function readRows(): Promise<PermissionRow[]> {
    try {
      const cached = await kv.get<PermissionRow[]>(KEY);
      if (Array.isArray(cached)) return cached;
    } catch {
      // Redis down: read the database.
    }
    const rows = await adapter.findAllRolePermissions();
    await kv.set(KEY, rows, { ttlSeconds: TTL_SECONDS }).catch(() => undefined);
    return rows;
  }

  /** One read per request. A database with no rows at all has not been seeded: use the defaults. */
  const loadMatrix = cache(async (): Promise<Matrix> => {
    const rows = await readRows();
    return rows.length === 0 ? defaultMatrix() : matrixFromRows(rows);
  });

  async function invalidateMatrix(): Promise<void> {
    await kv.del(KEY).catch(() => undefined);
  }

  const getRolePermissions = cache(async (role: RoleName): Promise<readonly Permission[]> => {
    if (role === "DEVELOPER") return PERMISSIONS;
    const matrix = await loadMatrix();
    return PERMISSIONS.filter((permission) => matrix[role].has(permission));
  });

  async function roleCan(role: RoleName, permission: Permission): Promise<boolean> {
    return canWith(await loadMatrix(), role, permission);
  }

  /**
   * Replaces the MANAGER and EDITOR rows and writes the audit row in the same
   * transaction. The caller checks the permission. An empty matrix is stored as
   * no rows, which reads back as the defaults (see loadMatrix).
   */
  async function replaceMatrix(matrix: Matrix, updatedById: string, event: AuditEvent): Promise<void> {
    const rows = matrixToRows(matrix).filter((row) => isPermission(row.permission));
    await adapter.withTransaction(async (tx) => {
      await adapter.deleteRolePermissions(["MANAGER", "EDITOR"], tx);
      if (rows.length > 0) await adapter.createRolePermissions(rows.map((row) => ({ ...row, updatedById })), tx);
      await writeAudit(event, tx);
    });
    await invalidateMatrix();
  }

  return { loadMatrix, invalidateMatrix, getRolePermissions, roleCan, replaceMatrix };
}
