import "server-only";

import { db } from "@/lib/db/prisma";
import { invalidate } from "@/lib/cache/invalidate";
import { forPostList } from "@/lib/cache/plan";
import { audit } from "@/lib/admin/audit";
import { log } from "@/lib/log";

// Shared cron job logic, called by both the /api/cron/* routes (automatic,
// CRON_SECRET) and the manual "run now" action on the settings screen
// (manageCron, or manageSettings for audit-prune). Each job accepts an
// injectable database client so it can be unit tested with a fake, per the
// project rule that tests never touch the real database. Design:
// docs/plan/admin-cms-adr.md, Step 16.

export const DEFAULT_AUDIT_RETENTION_DAYS = 365;

/** Deleted rows younger than this are kept even once expired or revoked, so a
 * session or token that just expired is still visible for a moment on the
 * sessions screen and cannot be deleted mid-request. */
export const CLEANUP_GRACE_MS = 24 * 60 * 60 * 1000;

type PostDb = Pick<typeof db.post, "findMany" | "updateMany">;
type SessionDb = Pick<typeof db.userSession, "deleteMany">;
type TokenDb = Pick<typeof db.authToken, "deleteMany">;
type MfaDb = Pick<typeof db.mfaChallenge, "deleteMany">;
type AuditDb = Pick<typeof db.auditLog, "count" | "deleteMany" | "create">;

export interface BlogPublishDb {
  post: PostDb;
}

export interface SessionCleanupDb {
  userSession: SessionDb;
  authToken: TokenDb;
  mfaChallenge: MfaDb;
}

export interface AuditPruneDb {
  auditLog: AuditDb;
}

/**
 * Publish scheduled blog posts that have reached their publish time.
 * Flips Post.status from SCHEDULED to PUBLISHED and sets publishedAt.
 * Idempotent: a post already PUBLISHED never matches the where clause again.
 */
export async function blogPublishJob(client: BlogPublishDb = db): Promise<{ published: number; error?: string }> {
  try {
    const now = new Date();

    const toPublish = await client.post.findMany({
      where: { status: "SCHEDULED", publishAt: { lte: now } },
      select: { id: true, slug: true },
    });

    if (toPublish.length === 0) {
      log.info("blog publish cron: no posts to publish");
      return { published: 0 };
    }

    const result = await client.post.updateMany({
      where: { status: "SCHEDULED", publishAt: { lte: now } },
      data: { status: "PUBLISHED", publishedAt: now },
    });

    // A cache-invalidation failure (for example: called outside a Next.js
    // request scope, or a transient revalidateTag error) must never be
    // reported as "nothing was published" when the database write already
    // succeeded, so it is isolated from the job's own result.
    try {
      invalidate(forPostList());
    } catch (err) {
      log.warn("blog publish cron: cache invalidation failed", { error: String(err) });
    }

    log.info("blog publish cron: published posts", { count: result.count });
    return { published: result.count };
  } catch (err) {
    const error = String(err);
    log.error("blog publish cron failed", { error });
    return { published: 0, error };
  }
}

/**
 * Clean up expired and revoked sessions, and expired auth tokens and MFA
 * challenges, all past a grace period so nothing is deleted the moment it
 * lapses. Idempotent: a second run finds nothing left to delete.
 */
export async function sessionCleanupJob(client: SessionCleanupDb = db): Promise<{ deleted: number; error?: string }> {
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - CLEANUP_GRACE_MS);

    // Sessions: expired past the grace period, or revoked past the grace period.
    const sessionResult = await client.userSession.deleteMany({
      where: {
        OR: [{ expiresAt: { lte: cutoff } }, { revokedAt: { lte: cutoff } }],
      },
    });

    // Invite and reset tokens: expired past the grace period. A used or revoked
    // token with no expiry change stays until it too ages out, which keeps a
    // short audit trail of recently accepted invites.
    const tokenResult = await client.authToken.deleteMany({
      where: { expiresAt: { lte: cutoff } },
    });

    // MFA challenges: expired past the grace period.
    const mfaResult = await client.mfaChallenge.deleteMany({
      where: { expiresAt: { lte: cutoff } },
    });

    const totalDeleted = sessionResult.count + tokenResult.count + mfaResult.count;

    log.info("session cleanup cron: deleted expired records", {
      sessions: sessionResult.count,
      tokens: tokenResult.count,
      mfa: mfaResult.count,
      total: totalDeleted,
    });

    return { deleted: totalDeleted };
  } catch (err) {
    const error = String(err);
    log.error("session cleanup cron failed", { error });
    return { deleted: 0, error };
  }
}

/**
 * Prune audit log rows older than the retention period (default 365 days).
 * Writes an audit row for the prune itself, so the deletion is traceable even
 * though most of what it deleted no longer exists to show a "before".
 */
export async function auditPruneJob(
  options: { retentionDays?: number } = {},
  client: AuditPruneDb = db
): Promise<{ deleted: number; error?: string }> {
  try {
    const retentionDays = options.retentionDays ?? DEFAULT_AUDIT_RETENTION_DAYS;
    const now = new Date();
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    const toDelete = await client.auditLog.count({ where: { createdAt: { lt: cutoff } } });
    if (toDelete === 0) {
      log.info("audit prune cron: no old audit entries to delete");
      return { deleted: 0 };
    }

    const result = await client.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });

    await audit(
      {
        action: "audit.exported",
        entityType: "AuditLog",
        meta: { op: "prune", deletedRows: result.count, retentionDays },
      },
      client
    );

    log.info("audit prune cron: pruned old audit entries", { count: result.count, retentionDays });
    return { deleted: result.count };
  } catch (err) {
    const error = String(err);
    log.error("audit prune cron failed", { error });
    return { deleted: 0, error };
  }
}
