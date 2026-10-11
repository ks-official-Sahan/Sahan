import type { AdapterPasskey, AdapterSessionRow, AuthDbAdapter, MfaPurpose } from "../adapter";

// AuthDbAdapter over Prisma. Typed against the few model delegates it calls,
// not a generated client, so it works with any client generated from a schema
// that has auth-kit's models (see prisma/auth.prisma in this package):
//
//   const adapter = createPrismaAuthAdapter<Prisma.TransactionClient>(db);

// Prisma's delegate methods are generic over each model's own argument types;
// `any` here is the one boundary that lets any generated client fit.
type Loose = any;

interface Delegate {
  findUnique(args: Loose): PromiseLike<Loose>;
  findFirst(args: Loose): PromiseLike<Loose>;
  findMany(args: Loose): PromiseLike<Loose[]>;
  count(args?: Loose): PromiseLike<number>;
  create(args: Loose): PromiseLike<Loose>;
  createMany(args: Loose): PromiseLike<{ count: number }>;
  update(args: Loose): PromiseLike<Loose>;
  updateMany(args: Loose): PromiseLike<{ count: number }>;
  deleteMany(args: Loose): PromiseLike<{ count: number }>;
}

/** The models auth-kit reads and writes. A transaction client has them too. */
export interface PrismaAuthModels {
  user: Pick<Delegate, "findUnique" | "update" | "updateMany" | "count">;
  userSession: Pick<Delegate, "create" | "findFirst" | "findUnique" | "findMany" | "updateMany">;
  rolePermission: Pick<Delegate, "findMany" | "deleteMany" | "createMany">;
  mfaChallenge: Pick<Delegate, "findMany" | "updateMany" | "create" | "findFirst" | "findUnique">;
  mfaRecoveryCode: Pick<Delegate, "count" | "createMany" | "deleteMany" | "updateMany">;
  webAuthnCredential: Pick<Delegate, "findMany" | "findUnique" | "create" | "updateMany" | "deleteMany">;
}

const PASSKEY_SELECT = {
  id: true,
  userId: true,
  publicKey: true,
  counter: true,
  transports: true,
  deviceType: true,
  backedUp: true,
  name: true,
  createdAt: true,
  lastUsedAt: true,
} as const;

/** The counter is a BIGINT column (an unsigned 32-bit value): a bigint in Prisma, a number here. */
const passkeyOf = (row: Loose): AdapterPasskey => ({ ...row, counter: Number(row.counter) });

export interface PrismaAuthClient<TTx> extends PrismaAuthModels {
  $transaction<T>(fn: (tx: TTx) => Promise<T>): Promise<T>;
}

export function createPrismaAuthAdapter<TTx extends PrismaAuthModels = PrismaAuthModels>(db: PrismaAuthClient<TTx>): AuthDbAdapter<TTx> {
  const client = (tx?: TTx): PrismaAuthModels => tx ?? db;

  return {
    withTransaction(fn) {
      return db.$transaction(fn);
    },

    // -- users --
    async findUserForAuth(email) {
      const row = await db.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          passwordHash: true,
          disabledAt: true,
          mfaEnabled: true,
          totpEnabledAt: true,
          _count: { select: { passkeys: true } },
        },
      });
      if (!row) return null;
      const { totpEnabledAt, _count, ...user } = row;
      return { ...user, strongMfa: totpEnabledAt !== null || _count.passkeys > 0 };
    },
    async findUserById(id) {
      return db.user.findUnique({
        where: { id },
        select: { id: true, email: true, name: true, role: true, passwordHash: true },
      });
    },
    async updateLastLoginAt(userId, when) {
      await db.user.update({ where: { id: userId }, data: { lastLoginAt: when } });
    },
    async countUsers() {
      return db.user.count();
    },

    // -- sessions --
    async createUserSession(input) {
      return db.userSession.create({ data: input, select: { id: true } });
    },
    async findFirstSessionByFingerprint(input) {
      return db.userSession.findFirst({
        where: { userId: input.userId, ip: input.ip, browser: input.browser, os: input.os },
        select: { id: true },
      });
    },
    async findSessionWithUser(sid) {
      const row = await db.userSession.findUnique({
        where: { id: sid },
        select: {
          expiresAt: true,
          revokedAt: true,
          mfaVerified: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              disabledAt: true,
              passwordHash: true,
              mustChangePassword: true,
              mfaEnabled: true,
              totpEnabledAt: true,
              _count: { select: { passkeys: true } },
            },
          },
        },
      });
      if (!row) return null;
      const { totpEnabledAt, _count, ...user } = row.user;
      return { ...row, user: { ...user, strongMfa: totpEnabledAt !== null || _count.passkeys > 0 } };
    },
    async touchSession(sid, when) {
      await db.userSession.updateMany({ where: { id: sid, revokedAt: null }, data: { lastSeenAt: when } });
    },
    async findActiveSessionIds(userId) {
      const rows: { id: string }[] = await db.userSession.findMany({ where: { userId, revokedAt: null }, select: { id: true } });
      return rows.map((row) => row.id);
    },
    async revokeSessionById(sid, revokedById, reason) {
      const { count } = await db.userSession.updateMany({
        where: { id: sid, revokedAt: null },
        data: { revokedAt: new Date(), revokedById, revokeReason: reason },
      });
      return { count };
    },
    async findActiveSessionIdsExcept(userId, exceptSid) {
      const rows: { id: string }[] = await db.userSession.findMany({
        where: { userId, revokedAt: null, ...(exceptSid ? { id: { not: exceptSid } } : {}) },
        select: { id: true },
      });
      return rows.map((row) => row.id);
    },
    async revokeSessionsByIds(ids, revokedById, reason) {
      if (ids.length === 0) return;
      await db.userSession.updateMany({
        where: { id: { in: ids }, revokedAt: null },
        data: { revokedAt: new Date(), revokedById, revokeReason: reason },
      });
    },
    async findAllActiveSessions(exceptUserId) {
      return db.userSession.findMany({
        where: { revokedAt: null, expiresAt: { gt: new Date() }, ...(exceptUserId ? { userId: { not: exceptUserId } } : {}) },
        select: { id: true, userId: true },
      });
    },
    async findRecentSessionIps(take) {
      const rows: { ip: string | null; lastSeenAt: Date; user: { email: string } }[] = await db.userSession.findMany({
        where: { ip: { not: null } },
        orderBy: { lastSeenAt: "desc" },
        take,
        select: { ip: true, lastSeenAt: true, user: { select: { email: true } } },
      });
      return rows.flatMap((row) => (row.ip === null ? [] : [{ ip: row.ip, lastSeenAt: row.lastSeenAt, userEmail: row.user.email }]));
    },
    async findSessionsList(options) {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      const rows: (Omit<AdapterSessionRow, "userEmail" | "userName"> & { user: { email: string; name: string | null } })[] =
        await db.userSession.findMany({
          where: {
            ...(options.userId ? { userId: options.userId } : {}),
            ...(options.includeEnded
              ? { OR: [{ revokedAt: null, expiresAt: { gt: now } }, { lastSeenAt: { gte: weekAgo } }] }
              : { revokedAt: null, expiresAt: { gt: now } }),
          },
          orderBy: { lastSeenAt: "desc" },
          take: options.take,
          select: {
            id: true,
            userId: true,
            ip: true,
            browser: true,
            os: true,
            device: true,
            mfaVerified: true,
            createdAt: true,
            lastSeenAt: true,
            expiresAt: true,
            revokedAt: true,
            revokeReason: true,
            user: { select: { email: true, name: true } },
          },
        });
      return rows.map(({ user, ...row }) => ({ ...row, userEmail: user.email, userName: user.name }));
    },

    // -- rbac --
    async findAllRolePermissions() {
      return db.rolePermission.findMany({ select: { role: true, permission: true } });
    },
    async deleteRolePermissions(roles, tx) {
      if (roles.length === 0) return;
      await client(tx).rolePermission.deleteMany({ where: { role: { in: roles } } });
    },
    async createRolePermissions(rows, tx) {
      if (rows.length === 0) return;
      await client(tx).rolePermission.createMany({ data: rows });
    },

    // -- mfa --
    async findOpenMfaChallenges(userId, purpose, now) {
      return db.mfaChallenge.findMany({
        where: { userId, purpose, consumedAt: null, expiresAt: { gt: now } },
        select: { attempts: true, expiresAt: true },
      });
    },
    async expireOpenMfaChallenges(userId, purpose, now, tx) {
      await client(tx).mfaChallenge.updateMany({
        where: { userId, purpose, consumedAt: null, expiresAt: { gt: now } },
        data: { expiresAt: now },
      });
    },
    async createMfaChallenge(input, tx) {
      await client(tx).mfaChallenge.create({ data: input });
    },
    async expireMfaChallengeById(id, when) {
      await db.mfaChallenge.updateMany({ where: { id }, data: { expiresAt: when } });
    },
    async findMfaChallengeById(id, userId, purpose) {
      const row = await db.mfaChallenge.findFirst({
        where: { id, userId, purpose },
        select: { id: true, userId: true, purpose: true, codeHash: true, attempts: true, verifiedAt: true, consumedAt: true, expiresAt: true },
      });
      return row ? { ...row, purpose: row.purpose as MfaPurpose } : null;
    },
    async incrementMfaAttempts(id, now, maxAttempts) {
      const { count } = await db.mfaChallenge.updateMany({
        where: { id, consumedAt: null, expiresAt: { gt: now }, attempts: { lt: maxAttempts } },
        data: { attempts: { increment: 1 } },
      });
      return { count };
    },
    async findMfaChallengeAttempts(id) {
      return db.mfaChallenge.findUnique({ where: { id }, select: { attempts: true } });
    },
    async markMfaChallengeVerified(id, when) {
      await db.mfaChallenge.updateMany({ where: { id, verifiedAt: null }, data: { verifiedAt: when } });
    },
    async consumeMfaChallenge(input) {
      const { count } = await db.mfaChallenge.updateMany({
        where: {
          id: input.id,
          userId: input.userId,
          purpose: input.purpose,
          consumedAt: null,
          verifiedAt: { gte: new Date(input.now.getTime() - input.verifiedWindowSeconds * 1000) },
          expiresAt: { gt: input.now },
        },
        data: { consumedAt: input.now },
      });
      return { count };
    },
    async findMfaChallengeOwner(id, purpose) {
      return db.mfaChallenge.findFirst({
        where: { id, purpose, consumedAt: null },
        select: { userId: true, user: { select: { id: true, email: true, name: true, disabledAt: true } } },
      });
    },

    // -- factors --
    async findMfaFactors(userId, tx) {
      const models = client(tx);
      const row = await models.user.findUnique({
        where: { id: userId },
        select: { mfaEnabled: true, totpSecretCipher: true, totpEnabledAt: true, _count: { select: { passkeys: true } } },
      });
      if (!row) return null;
      const recoveryCodesLeft = await models.mfaRecoveryCode.count({ where: { userId, usedAt: null } });
      return { mfaEnabled: row.mfaEnabled, totpSecretCipher: row.totpSecretCipher, totpEnabledAt: row.totpEnabledAt, passkeys: row._count.passkeys, recoveryCodesLeft };
    },
    async setTotpSecret(userId, cipher, enabledAt, tx) {
      await client(tx).user.updateMany({ where: { id: userId }, data: { totpSecretCipher: cipher, totpEnabledAt: enabledAt } });
    },
    async lockUser(userId, tx) {
      // An UPDATE takes the row lock (Prisma has no SELECT ... FOR UPDATE).
      await client(tx).user.updateMany({ where: { id: userId }, data: { updatedAt: new Date() } });
    },
    async beginTotpSecret(userId, cipher) {
      const { count } = await db.user.updateMany({ where: { id: userId, totpEnabledAt: null }, data: { totpSecretCipher: cipher } });
      return { count };
    },
    async confirmTotpSecret(userId, cipher, when, tx) {
      const { count } = await client(tx).user.updateMany({
        where: { id: userId, totpSecretCipher: cipher, totpEnabledAt: null },
        data: { totpEnabledAt: when },
      });
      return { count };
    },
    async replaceRecoveryCodes(userId, codeHashes, tx) {
      const models = client(tx);
      await models.mfaRecoveryCode.deleteMany({ where: { userId } });
      if (codeHashes.length > 0) await models.mfaRecoveryCode.createMany({ data: codeHashes.map((codeHash) => ({ userId, codeHash })) });
    },
    async consumeRecoveryCode(userId, codeHash, when) {
      const { count } = await db.mfaRecoveryCode.updateMany({ where: { userId, codeHash, usedAt: null }, data: { usedAt: when } });
      return { count };
    },
    async listPasskeys(userId) {
      const rows = await db.webAuthnCredential.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: PASSKEY_SELECT });
      return rows.map(passkeyOf);
    },
    async findPasskey(id) {
      const row = await db.webAuthnCredential.findUnique({ where: { id }, select: PASSKEY_SELECT });
      return row ? passkeyOf(row) : null;
    },
    async createPasskey(input, tx) {
      await client(tx).webAuthnCredential.create({ data: { ...input, counter: BigInt(input.counter) } });
    },
    async updatePasskeyUse(id, counter, when) {
      await db.webAuthnCredential.updateMany({ where: { id }, data: { counter: BigInt(counter), lastUsedAt: when } });
    },
    async deletePasskey(userId, id, tx) {
      const { count } = await client(tx).webAuthnCredential.deleteMany({ where: { id, userId } });
      return { count };
    },
    async deletePasskeys(userId, tx) {
      const { count } = await client(tx).webAuthnCredential.deleteMany({ where: { userId } });
      return { count };
    },
  };
}
