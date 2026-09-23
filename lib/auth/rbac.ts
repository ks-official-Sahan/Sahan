import "server-only";

import { audit } from "@/lib/admin/audit";
import { kv } from "@/lib/cache/redis";
import { createRbac } from "@sahan/auth-kit/rbac";

import { prismaAuthAdapter } from "./prisma-adapter";

// The role by permission matrix, from Postgres with a 60 second Redis copy.
// docs/plan/admin-cms-adr.md, sections 6.5 and 9.

export const { loadMatrix, invalidateMatrix, getRolePermissions, roleCan, replaceMatrix } = createRbac({
  adapter: prismaAuthAdapter,
  kv,
  writeAudit: (event, tx) => audit(event, tx as Parameters<typeof audit>[1]),
});
