import type { DashboardRepo, MaintenanceRepo } from "../maintenance";
import type { DbClient } from "./client";
import { table } from "./raw";

export function maintenanceRepo(client: DbClient): MaintenanceRepo {
  return {
    async publishDuePosts(now) {
      const { count } = await client.post.updateMany({
        where: { status: "SCHEDULED", publishAt: { lte: now } },
        data: { status: "PUBLISHED", publishedAt: now },
      });
      return count;
    },
    async deleteEndedSessions(cutoff) {
      const { count } = await client.userSession.deleteMany({
        where: { OR: [{ expiresAt: { lte: cutoff } }, { revokedAt: { lte: cutoff } }] },
      });
      return count;
    },
    async deleteExpiredAuthTokens(cutoff) {
      return (await client.authToken.deleteMany({ where: { expiresAt: { lte: cutoff } } })).count;
    },
    async deleteExpiredMfaChallenges(cutoff) {
      return (await client.mfaChallenge.deleteMany({ where: { expiresAt: { lte: cutoff } } })).count;
    },
    async oldestAuditIdsBefore(cutoff, take) {
      const rows = await client.auditLog.findMany({
        where: { createdAt: { lt: cutoff } },
        orderBy: { createdAt: "asc" },
        select: { id: true },
        take,
      });
      return rows.map((row) => row.id);
    },
    async deleteAuditRows(ids) {
      if (ids.length === 0) return 0;
      return (await client.auditLog.deleteMany({ where: { id: { in: ids } } })).count;
    },
    pruneRevisions(keep) {
      // A window function ranks each post's revisions newest first; everything
      // past the cap goes, however many posts have history.
      return client.$executeRaw`
        DELETE FROM ${table("post_revisions")}
        WHERE id IN (
          SELECT id FROM (
            SELECT id, row_number() OVER (PARTITION BY "postId" ORDER BY "createdAt" DESC) AS rank
            FROM ${table("post_revisions")}
          ) ranked
          WHERE ranked.rank > ${keep}
        )`;
    },
    async ping() {
      await client.$queryRaw`SELECT 1`;
    },
  };
}

export function dashboardRepo(client: DbClient): DashboardRepo {
  return {
    async activitySeries(days, hideActorRole) {
      const span = Math.min(Math.max(Math.trunc(days), 1), 90);
      const hide = hideActorRole ?? null;
      const rows = await client.$queryRaw<{ day: string; inquiries: number; posts: number; activity: number }[]>`
        WITH days AS (
          SELECT generate_series(
            date_trunc('day', now() AT TIME ZONE 'UTC') - make_interval(days => ${span - 1}::int),
            date_trunc('day', now() AT TIME ZONE 'UTC'),
            interval '1 day'
          ) AS day
        ),
        since AS (SELECT min(day) AS start FROM days),
        i AS (
          SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS n
          FROM ${table("inquiries")}, since WHERE "createdAt" >= since.start GROUP BY 1
        ),
        p AS (
          SELECT date_trunc('day', "publishedAt") AS day, count(*)::int AS n
          FROM ${table("posts")}, since WHERE status = 'PUBLISHED' AND "publishedAt" >= since.start GROUP BY 1
        ),
        a AS (
          SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS n
          FROM ${table("audit_logs")}, since
          WHERE "createdAt" >= since.start AND (${hide}::text IS NULL OR "actorRole" IS DISTINCT FROM ${hide}::text)
          GROUP BY 1
        )
        SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
               COALESCE(i.n, 0) AS inquiries, COALESCE(p.n, 0) AS posts, COALESCE(a.n, 0) AS activity
        FROM days
        LEFT JOIN i ON i.day = days.day
        LEFT JOIN p ON p.day = days.day
        LEFT JOIN a ON a.day = days.day
        ORDER BY days.day`;
      return rows.map((row) => ({ day: row.day, inquiries: Number(row.inquiries), posts: Number(row.posts), activity: Number(row.activity) }));
    },
    recentActivity(limit, hideActorRole) {
      return client.auditLog.findMany({
        where: hideActorRole ? { OR: [{ actorRole: null }, { actorRole: { not: hideActorRole } }] } : undefined,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, action: true, createdAt: true, actorEmail: true, entityType: true, entityId: true },
      });
    },
    countDraftBlocks() {
      return client.contentBlock.count({ where: { status: "DRAFT" } });
    },
    countUnpublishedPosts() {
      return client.post.count({ where: { status: { in: ["DRAFT", "SCHEDULED"] } } });
    },
    countNewInquiries() {
      return client.inquiry.count({ where: { status: "NEW" } });
    },
  };
}
