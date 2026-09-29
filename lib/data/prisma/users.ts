import type { RoleName } from "@/lib/auth/permissions";

import type { UserRepo } from "../users";
import type { DbClient } from "./client";

export function userRepo(client: DbClient): UserRepo {
  return {
    async findAccessState(id) {
      const row = await client.user.findUnique({ where: { id }, select: { id: true, role: true, disabledAt: true } });
      return row ? { ...row, role: row.role as RoleName } : null;
    },
  };
}
