export interface AuditEvent {
  action: string;
  actor?: { id?: string | null; email?: string | null } | null;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: Record<string, unknown>;
  /** Taken from the request headers when left out. */
  ip?: string | null;
  userAgent?: string | null;
}
