import "server-only";

import { db } from "@/lib/db/prisma";
import { log } from "@/lib/log";

// Dashboard helper: queries for the admin dashboard widgets.
// All queries are tolerant of an unconfigured database (missing tables).
// Design: docs/plan/admin-cms-adr.md, Step 16.

/**
 * Get recent audit log entries (last 10).
 */
export async function getRecentActivity(limit = 10) {
  try {
    return await db.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        createdAt: true,
        actorEmail: true,
        entityType: true,
        entityId: true,
      },
    });
  } catch {
    return [];
  }
}

/**
 * Count draft content blocks (status = DRAFT).
 */
export async function getDraftCount() {
  try {
    return await db.contentBlock.count({
      where: { status: "DRAFT" },
    });
  } catch {
    return 0;
  }
}

/**
 * Count unpublished changes in the database.
 * This is content blocks with status DRAFT or posts with status DRAFT.
 */
export async function getUnpublishedCount() {
  try {
    const blocks = await db.contentBlock.count({
      where: { status: "DRAFT" },
    });
    const posts = await db.post.count({
      where: { status: { in: ["DRAFT", "SCHEDULED"] } },
    });
    return blocks + posts;
  } catch {
    return 0;
  }
}

/**
 * Count new inquiries (status = NEW).
 */
export async function getNewInquiriesCount() {
  try {
    return await db.inquiry.count({
      where: { status: "NEW" },
    });
  } catch {
    return 0;
  }
}

/**
 * Get system health status: database connection, redis (if configured).
 */
export async function getSystemHealth() {
  const health = {
    database: false,
    redis: false,
  };

  // Database check
  try {
    await db.$queryRawUnsafe("SELECT 1");
    health.database = true;
  } catch {
    // Database is down
  }

  // Redis check (if configured)
  try {
    const { kv } = await import("@/lib/cache/redis");
    await kv.get("health-check");
    health.redis = true;
  } catch {
    // Redis is not available or not configured
  }

  return health;
}

/**
 * Get email configuration health.
 */
export async function getEmailHealth() {
  try {
    const { emailConfigFromEnv } = await import("@/lib/email/config");
    const { emailHealth } = await import("@/lib/email/health");
    // The typed, validated env (lib/env.ts) defaults EMAIL_PROVIDER to "auto"
    // when unset. Reading raw process.env here left config.mode undefined
    // whenever EMAIL_PROVIDER was not set in .env.local, which made
    // providerOrder() throw and this whole function silently return null —
    // rendering as "Not configured" even with Resend fully set up.
    const { getEnv } = await import("@/lib/env");
    const env = getEnv();
    const config = emailConfigFromEnv(env);
    return emailHealth(config, {
      production: process.env.NODE_ENV === "production",
      brevoApiKey: Boolean(env.EMAIL_BREVO_API_KEY),
    });
  } catch (err) {
    log.error("email health check failed", { error: String(err) });
    return null;
  }
}

/**
 * Get security status for the current user.
 */
export async function getUserSecurityStatus(userId: string) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        mfaEnabled: true,
        mustChangePassword: true,
      },
    });
    return user ?? { mfaEnabled: false, mustChangePassword: false };
  } catch {
    return { mfaEnabled: false, mustChangePassword: false };
  }
}
