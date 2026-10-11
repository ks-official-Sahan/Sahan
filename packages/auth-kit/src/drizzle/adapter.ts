import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgDatabase, PgQueryResultHKT, PgTable } from "drizzle-orm/pg-core";

import type { AdapterSessionRow, AuthDbAdapter, MfaPurpose } from "../adapter";
import type { AuthSchema } from "./schema";

// AuthDbAdapter over Drizzle (Postgres). Same behaviour as the Prisma adapter;
// both run one shared contract suite in the package tests. Update counts come
// from RETURNING rather than the driver's rowCount, so every Postgres driver
// (node-postgres, postgres.js, Neon, PGlite) reports them the same way.

/** Any Drizzle Postgres database or transaction. */
export type DrizzlePgDatabase = PgDatabase<PgQueryResultHKT, any, any>;

/** `column = value`, or `column IS NULL` when value is null (Prisma's `where: { column: null }`). */
function eqOrNull(column: Parameters<typeof eq>[0], value: string | null): SQL {
  return value === null ? isNull(column) : eq(column, value);
}

export function createDrizzleAuthAdapter<TRole extends string>(
  db: DrizzlePgDatabase,
  schema: AuthSchema<TRole>
): AuthDbAdapter<DrizzlePgDatabase> {
  // The adapter interface carries roles as plain strings; the database enum
  // still rejects a role that is not in the schema.
  const { users, userSessions, rolePermissions, mfaChallenges, mfaRecoveryCodes, webauthnCredentials } = schema as unknown as AuthSchema;
  const client = (tx?: DrizzlePgDatabase) => tx ?? db;
  const first = <T>(rows: T[]): T | null => rows[0] ?? null;
  // A column always qualified by its table (and schema). Drizzle leaves columns
  // bare in a single-table select, which a correlated subquery would misread.
  const col = (table: PgTable, column: AnyPgColumn) => sql`${table}.${sql.identifier(column.name)}`;
  const passkeyCount = sql<number>`(SELECT count(*)::int FROM ${webauthnCredentials} WHERE ${col(webauthnCredentials, webauthnCredentials.userId)} = ${col(users, users.id)})`;
  // A confirmed authenticator app or any passkey.
  const STRONG_MFA = sql<boolean>`(${col(users, users.totpEnabledAt)} IS NOT NULL OR ${passkeyCount} > 0)`.mapWith(Boolean);

  return {
    withTransaction(fn) {
      return db.transaction((tx) => fn(tx));
    },

    // -- users --
    async findUserForAuth(email) {
      return first(
        await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            passwordHash: users.passwordHash,
            disabledAt: users.disabledAt,
            mfaEnabled: users.mfaEnabled,
            strongMfa: STRONG_MFA,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1)
      );
    },
    async findUserById(id) {
      return first(
        await db
          .select({ id: users.id, email: users.email, name: users.name, role: users.role, passwordHash: users.passwordHash })
          .from(users)
          .where(eq(users.id, id))
          .limit(1)
      );
    },
    async updateLastLoginAt(userId, when) {
      await db.update(users).set({ lastLoginAt: when }).where(eq(users.id, userId));
    },
    async countUsers() {
      const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
      return row.count;
    },

    // -- sessions --
    async createUserSession(input) {
      const [row] = await db.insert(userSessions).values(input).returning({ id: userSessions.id });
      return row;
    },
    async findFirstSessionByFingerprint(input) {
      return first(
        await db
          .select({ id: userSessions.id })
          .from(userSessions)
          .where(
            and(
              eq(userSessions.userId, input.userId),
              eqOrNull(userSessions.ip, input.ip),
              eqOrNull(userSessions.browser, input.browser),
              eqOrNull(userSessions.os, input.os)
            )
          )
          .limit(1)
      );
    },
    async findSessionWithUser(sid) {
      return first(
        await db
          .select({
            expiresAt: userSessions.expiresAt,
            revokedAt: userSessions.revokedAt,
            mfaVerified: userSessions.mfaVerified,
            user: {
              id: users.id,
              email: users.email,
              name: users.name,
              role: users.role,
              disabledAt: users.disabledAt,
              passwordHash: users.passwordHash,
              mustChangePassword: users.mustChangePassword,
              mfaEnabled: users.mfaEnabled,
              strongMfa: STRONG_MFA,
            },
          })
          .from(userSessions)
          .innerJoin(users, eq(users.id, userSessions.userId))
          .where(eq(userSessions.id, sid))
          .limit(1)
      );
    },
    async touchSession(sid, when) {
      await db
        .update(userSessions)
        .set({ lastSeenAt: when })
        .where(and(eq(userSessions.id, sid), isNull(userSessions.revokedAt)));
    },
    async findActiveSessionIds(userId) {
      const rows = await db
        .select({ id: userSessions.id })
        .from(userSessions)
        .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
      return rows.map((row) => row.id);
    },
    async revokeSessionById(sid, revokedById, reason) {
      const rows = await db
        .update(userSessions)
        .set({ revokedAt: new Date(), revokedById, revokeReason: reason })
        .where(and(eq(userSessions.id, sid), isNull(userSessions.revokedAt)))
        .returning({ id: userSessions.id });
      return { count: rows.length };
    },
    async findActiveSessionIdsExcept(userId, exceptSid) {
      const rows = await db
        .select({ id: userSessions.id })
        .from(userSessions)
        .where(
          and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt), exceptSid ? ne(userSessions.id, exceptSid) : undefined)
        );
      return rows.map((row) => row.id);
    },
    async revokeSessionsByIds(ids, revokedById, reason) {
      if (ids.length === 0) return;
      await db
        .update(userSessions)
        .set({ revokedAt: new Date(), revokedById, revokeReason: reason })
        .where(and(inArray(userSessions.id, ids), isNull(userSessions.revokedAt)));
    },
    async findAllActiveSessions(exceptUserId) {
      return db
        .select({ id: userSessions.id, userId: userSessions.userId })
        .from(userSessions)
        .where(
          and(
            isNull(userSessions.revokedAt),
            gt(userSessions.expiresAt, new Date()),
            exceptUserId ? ne(userSessions.userId, exceptUserId) : undefined
          )
        );
    },
    async findRecentSessionIps(take) {
      const rows = await db
        .select({ ip: userSessions.ip, lastSeenAt: userSessions.lastSeenAt, userEmail: users.email })
        .from(userSessions)
        .innerJoin(users, eq(users.id, userSessions.userId))
        .where(isNotNull(userSessions.ip))
        .orderBy(desc(userSessions.lastSeenAt))
        .limit(take);
      return rows.filter((row): row is typeof row & { ip: string } => row.ip !== null);
    },
    async findSessionsList(options) {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      const active = and(isNull(userSessions.revokedAt), gt(userSessions.expiresAt, now));
      const rows: AdapterSessionRow[] = await db
        .select({
          id: userSessions.id,
          userId: userSessions.userId,
          ip: userSessions.ip,
          browser: userSessions.browser,
          os: userSessions.os,
          device: userSessions.device,
          mfaVerified: userSessions.mfaVerified,
          createdAt: userSessions.createdAt,
          lastSeenAt: userSessions.lastSeenAt,
          expiresAt: userSessions.expiresAt,
          revokedAt: userSessions.revokedAt,
          revokeReason: userSessions.revokeReason,
          userEmail: users.email,
          userName: users.name,
        })
        .from(userSessions)
        .innerJoin(users, eq(users.id, userSessions.userId))
        .where(
          and(
            options.userId ? eq(userSessions.userId, options.userId) : undefined,
            options.includeEnded ? or(active, gte(userSessions.lastSeenAt, weekAgo)) : active
          )
        )
        .orderBy(desc(userSessions.lastSeenAt))
        .limit(options.take);
      return rows;
    },

    // -- rbac --
    async findAllRolePermissions() {
      return db.select({ role: rolePermissions.role, permission: rolePermissions.permission }).from(rolePermissions);
    },
    async deleteRolePermissions(roles, tx) {
      if (roles.length === 0) return;
      await client(tx).delete(rolePermissions).where(inArray(rolePermissions.role, roles));
    },
    async createRolePermissions(rows, tx) {
      if (rows.length === 0) return;
      await client(tx).insert(rolePermissions).values(rows);
    },

    // -- mfa --
    async findOpenMfaChallenges(userId, purpose, now) {
      return db
        .select({ attempts: mfaChallenges.attempts, expiresAt: mfaChallenges.expiresAt })
        .from(mfaChallenges)
        .where(
          and(
            eq(mfaChallenges.userId, userId),
            eq(mfaChallenges.purpose, purpose),
            isNull(mfaChallenges.consumedAt),
            gt(mfaChallenges.expiresAt, now)
          )
        );
    },
    async expireOpenMfaChallenges(userId, purpose, now, tx) {
      await client(tx)
        .update(mfaChallenges)
        .set({ expiresAt: now })
        .where(
          and(
            eq(mfaChallenges.userId, userId),
            eq(mfaChallenges.purpose, purpose),
            isNull(mfaChallenges.consumedAt),
            gt(mfaChallenges.expiresAt, now)
          )
        );
    },
    async createMfaChallenge(input, tx) {
      await client(tx).insert(mfaChallenges).values(input);
    },
    async expireMfaChallengeById(id, when) {
      await db.update(mfaChallenges).set({ expiresAt: when }).where(eq(mfaChallenges.id, id));
    },
    async findMfaChallengeById(id, userId, purpose) {
      const row = first(
        await db
          .select({
            id: mfaChallenges.id,
            userId: mfaChallenges.userId,
            purpose: mfaChallenges.purpose,
            codeHash: mfaChallenges.codeHash,
            attempts: mfaChallenges.attempts,
            verifiedAt: mfaChallenges.verifiedAt,
            consumedAt: mfaChallenges.consumedAt,
            expiresAt: mfaChallenges.expiresAt,
          })
          .from(mfaChallenges)
          .where(and(eq(mfaChallenges.id, id), eq(mfaChallenges.userId, userId), eq(mfaChallenges.purpose, purpose)))
          .limit(1)
      );
      return row ? { ...row, purpose: row.purpose as MfaPurpose } : null;
    },
    async incrementMfaAttempts(id, now, maxAttempts) {
      const rows = await db
        .update(mfaChallenges)
        .set({ attempts: sql`${mfaChallenges.attempts} + 1` })
        .where(
          and(
            eq(mfaChallenges.id, id),
            isNull(mfaChallenges.consumedAt),
            gt(mfaChallenges.expiresAt, now),
            lt(mfaChallenges.attempts, maxAttempts)
          )
        )
        .returning({ id: mfaChallenges.id });
      return { count: rows.length };
    },
    async findMfaChallengeAttempts(id) {
      return first(await db.select({ attempts: mfaChallenges.attempts }).from(mfaChallenges).where(eq(mfaChallenges.id, id)).limit(1));
    },
    async markMfaChallengeVerified(id, when) {
      await db
        .update(mfaChallenges)
        .set({ verifiedAt: when })
        .where(and(eq(mfaChallenges.id, id), isNull(mfaChallenges.verifiedAt)));
    },
    async consumeMfaChallenge(input) {
      const rows = await db
        .update(mfaChallenges)
        .set({ consumedAt: input.now })
        .where(
          and(
            eq(mfaChallenges.id, input.id),
            eq(mfaChallenges.userId, input.userId),
            eq(mfaChallenges.purpose, input.purpose),
            isNull(mfaChallenges.consumedAt),
            gte(mfaChallenges.verifiedAt, new Date(input.now.getTime() - input.verifiedWindowSeconds * 1000)),
            gt(mfaChallenges.expiresAt, input.now)
          )
        )
        .returning({ id: mfaChallenges.id });
      return { count: rows.length };
    },
    async findMfaChallengeOwner(id, purpose) {
      return first(
        await db
          .select({
            userId: mfaChallenges.userId,
            user: { id: users.id, email: users.email, name: users.name, disabledAt: users.disabledAt },
          })
          .from(mfaChallenges)
          .innerJoin(users, eq(users.id, mfaChallenges.userId))
          .where(and(eq(mfaChallenges.id, id), eq(mfaChallenges.purpose, purpose), isNull(mfaChallenges.consumedAt)))
          .limit(1)
      );
    },

    // -- factors --
    async findMfaFactors(userId, tx) {
      return first(
        await client(tx)
          .select({
            mfaEnabled: users.mfaEnabled,
            totpSecretCipher: users.totpSecretCipher,
            totpEnabledAt: users.totpEnabledAt,
            passkeys: passkeyCount.mapWith(Number),
            recoveryCodesLeft: sql<number>`(SELECT count(*)::int FROM ${mfaRecoveryCodes} WHERE ${col(mfaRecoveryCodes, mfaRecoveryCodes.userId)} = ${col(users, users.id)} AND ${col(mfaRecoveryCodes, mfaRecoveryCodes.usedAt)} IS NULL)`.mapWith(Number),
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
      );
    },
    async setTotpSecret(userId, cipher, enabledAt, tx) {
      await client(tx).update(users).set({ totpSecretCipher: cipher, totpEnabledAt: enabledAt }).where(eq(users.id, userId));
    },
    async lockUser(userId, tx) {
      await client(tx).select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    },
    async beginTotpSecret(userId, cipher) {
      const rows = await db
        .update(users)
        .set({ totpSecretCipher: cipher })
        .where(and(eq(users.id, userId), isNull(users.totpEnabledAt)))
        .returning({ id: users.id });
      return { count: rows.length };
    },
    async confirmTotpSecret(userId, cipher, when, tx) {
      const rows = await client(tx)
        .update(users)
        .set({ totpEnabledAt: when })
        .where(and(eq(users.id, userId), eq(users.totpSecretCipher, cipher), isNull(users.totpEnabledAt)))
        .returning({ id: users.id });
      return { count: rows.length };
    },
    async replaceRecoveryCodes(userId, codeHashes, tx) {
      const target = client(tx);
      await target.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
      if (codeHashes.length > 0) await target.insert(mfaRecoveryCodes).values(codeHashes.map((codeHash) => ({ userId, codeHash })));
    },
    async consumeRecoveryCode(userId, codeHash, when) {
      const rows = await db
        .update(mfaRecoveryCodes)
        .set({ usedAt: when })
        .where(and(eq(mfaRecoveryCodes.userId, userId), eq(mfaRecoveryCodes.codeHash, codeHash), isNull(mfaRecoveryCodes.usedAt)))
        .returning({ id: mfaRecoveryCodes.id });
      return { count: rows.length };
    },
    async listPasskeys(userId) {
      const rows = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, userId)).orderBy(asc(webauthnCredentials.createdAt));
      return rows.map((row) => ({ ...row, transports: row.transports ?? [] }));
    },
    async findPasskey(id) {
      const row = first(await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.id, id)).limit(1));
      return row ? { ...row, transports: row.transports ?? [] } : null;
    },
    async createPasskey(input, tx) {
      await client(tx).insert(webauthnCredentials).values(input);
    },
    async updatePasskeyUse(id, counter, when) {
      await db.update(webauthnCredentials).set({ counter, lastUsedAt: when }).where(eq(webauthnCredentials.id, id));
    },
    async deletePasskey(userId, id, tx) {
      const rows = await client(tx)
        .delete(webauthnCredentials)
        .where(and(eq(webauthnCredentials.id, id), eq(webauthnCredentials.userId, userId)))
        .returning({ id: webauthnCredentials.id });
      return { count: rows.length };
    },
    async deletePasskeys(userId, tx) {
      const rows = await client(tx).delete(webauthnCredentials).where(eq(webauthnCredentials.userId, userId)).returning({ id: webauthnCredentials.id });
      return { count: rows.length };
    },
  };
}
