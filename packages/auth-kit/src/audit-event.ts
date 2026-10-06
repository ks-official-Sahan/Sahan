export interface AuditEvent {
  action: string;
  /** `role` is the actor's role at the time, kept on the row (`actorRole`) so a later role change or mask never re-exposes it. */
  actor?: { id?: string | null; email?: string | null; role?: string | null } | null;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: Record<string, unknown>;
  /** Taken from the request headers when left out. */
  ip?: string | null;
  userAgent?: string | null;
}
