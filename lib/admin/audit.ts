import "server-only";

import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";

import { db } from "@/lib/db/prisma";
import { AUDIT_SENSITIVE_KEY, log, redact as redactValue } from "@/lib/log";
import { clientIp, UNKNOWN_IP } from "@/lib/security/ip";

// The one writer for the audit trail (docs/plan/admin-cms-adr.md, section 6.9).
// Action names use domain.entity.verb, for example auth.login.success.

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

export interface AuditClient {
  auditLog: {
    create(args: { data: Prisma.AuditLogUncheckedCreateInput }): Promise<unknown>;
  };
}

/** Removes password, token, secret, hash, code and similar values from a payload. */
export function redact(value: unknown): unknown {
  return redactValue(value, AUDIT_SENSITIVE_KEY);
}

function json(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return redact(value) as Prisma.InputJsonValue;
}

async function requestContext(): Promise<{ ip?: string; userAgent?: string }> {
  try {
    const h = await headers();
    const ip = clientIp(h);
    return {
      ip: ip === UNKNOWN_IP ? undefined : ip,
      userAgent: h.get("user-agent") ?? undefined,
    };
  } catch {
    // Outside a request (a script or a test) there are no headers.
    return {};
  }
}

/** Writes one row. Throws when the write fails. */
export async function audit(event: AuditEvent, client: AuditClient = db): Promise<void> {
  const context = event.ip || event.userAgent ? {} : await requestContext();
  await client.auditLog.create({
    data: {
      action: event.action,
      actorId: event.actor?.id ?? null,
      actorEmail: event.actor?.email ?? null,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      before: json(event.before),
      after: json(event.after),
      meta: json(event.meta),
      ip: event.ip ?? context.ip ?? null,
      userAgent: (event.userAgent ?? context.userAgent ?? null)?.slice(0, 512) ?? null,
    },
  });
}

/**
 * For sign-in and sign-out, where a failed audit write must not turn a working
 * login into an outage. The failure itself is logged.
 */
export async function auditSafe(event: AuditEvent, client?: AuditClient): Promise<void> {
  try {
    await audit(event, client);
  } catch (error) {
    log.error("audit write failed", { action: event.action, error: (error as Error).message });
  }
}
