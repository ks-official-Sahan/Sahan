import "server-only";

import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";

import type { AuditEvent } from "@sahan-sac/auth-kit";
import { clientIp, UNKNOWN_IP } from "@sahan-sac/auth-kit/security";

import { repos, type Repos } from "@/lib/data";
import type { AuditRow } from "@/lib/data/audit";
import { AUDIT_SENSITIVE_KEY, log, redact as redactValue } from "@/lib/log";

// The one writer for the audit trail (docs/plan/admin-cms-adr.md, section 6.9).
// Action names use domain.entity.verb, for example auth.login.success.

export type { AuditEvent };

/** A raw Prisma transaction client. Deprecated: pass the repositories from withTx instead. */
export interface AuditClient {
  auditLog: {
    create(args: { data: Prisma.AuditLogUncheckedCreateInput }): Promise<unknown>;
  };
}

/** Where an audit row goes: the repositories (shared, or one transaction's from withTx). */
export type AuditTarget = Pick<Repos, "audit"> | AuditClient;

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

/** A raw Prisma transaction client. Deprecated: pass the repositories from withTx instead. */
export interface AuditManyClient {
  auditLog: {
    createMany(args: { data: Prisma.AuditLogCreateManyInput[] }): Promise<unknown>;
  };
}

export type AuditManyTarget = Pick<Repos, "audit"> | AuditManyClient;

function row(event: AuditEvent, context: { ip?: string; userAgent?: string }): AuditRow {
  return {
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
  };
}

/** Writes one row. Throws when the write fails. */
export async function audit(event: AuditEvent, client: AuditTarget = repos): Promise<void> {
  const context = event.ip || event.userAgent ? {} : await requestContext();
  const data = row(event, context);
  if ("audit" in client) await client.audit.create(data);
  else await client.auditLog.create({ data: data as Prisma.AuditLogUncheckedCreateInput });
}

/**
 * Writes one row per event in a single insert, for bulk actions: inside an
 * interactive transaction one round trip per row would add up fast (and can
 * outrun the transaction timeout). Throws when the write fails.
 */
export async function auditMany(events: AuditEvent[], client: AuditManyTarget = repos): Promise<void> {
  if (events.length === 0) return;
  const context = await requestContext();
  const rows = events.map((event) => row(event, context));
  if ("audit" in client) await client.audit.createMany(rows);
  else await client.auditLog.createMany({ data: rows as Prisma.AuditLogCreateManyInput[] });
}

/**
 * For sign-in and sign-out, where a failed audit write must not turn a working
 * login into an outage. The failure itself is logged.
 */
export async function auditSafe(event: AuditEvent, client?: AuditTarget): Promise<void> {
  try {
    await audit(event, client);
  } catch (error) {
    log.error("audit write failed", { action: event.action, error: (error as Error).message });
  }
}
