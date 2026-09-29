/** One audit_logs row, already redacted (see lib/admin/audit.ts). */
export interface AuditRow {
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  entityType: string;
  entityId: string | null;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
  ip: string | null;
  userAgent: string | null;
}

export interface AuditRepo {
  create(row: AuditRow): Promise<void>;
  /** One insert for many rows, for bulk actions inside a transaction. */
  createMany(rows: AuditRow[]): Promise<void>;
}
