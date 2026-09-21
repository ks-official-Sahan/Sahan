import "server-only";

import { cache } from "react";

import { db } from "@/lib/db/prisma";

import { isPermission, PERMISSIONS, type Permission, type RoleName } from "./permissions";

// Permissions of a role. DEVELOPER always holds everything, so a bad edit of the
// matrix can never lock the owner out; the other roles come from the database
// (docs/plan/admin-cms-adr.md, D9). The cache is per request. The roles step
// adds the matrix editor and a cross-request cache with invalidation.
export const getRolePermissions = cache(async (role: RoleName): Promise<readonly Permission[]> => {
  if (role === "DEVELOPER") return PERMISSIONS;
  const rows = await db.rolePermission.findMany({
    where: { role },
    select: { permission: true },
  });
  return rows.map((row) => row.permission).filter(isPermission);
});
