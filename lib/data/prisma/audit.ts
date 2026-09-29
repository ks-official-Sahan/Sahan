import type { Prisma } from "@prisma/client";

import type { AuditRepo, AuditRow } from "../audit";
import type { DbClient } from "./client";

function json(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined || value === null ? undefined : (value as Prisma.InputJsonValue);
}

function data(row: AuditRow): Prisma.AuditLogUncheckedCreateInput {
  return { ...row, before: json(row.before), after: json(row.after), meta: json(row.meta) };
}

export function auditRepo(client: DbClient): AuditRepo {
  return {
    async create(row) {
      await client.auditLog.create({ data: data(row) });
    },
    async createMany(rows) {
      if (rows.length === 0) return;
      await client.auditLog.createMany({ data: rows.map(data) });
    },
  };
}
