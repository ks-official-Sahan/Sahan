// DB-adapter the app implements with Prisma and injects into every
// adapter-backed module below. Auth-kit never imports Prisma or knows what a
// transaction client looks like beyond the opaque `TTx` it forwards between
// its own transactional call and the app's injected audit-write closure.

/**
 * Opaque role identifier at this loose, adapter-wide level (an app's own
 * `defineAuthKit` config — see ../kit.ts — carries the real, narrower role
 * union and the RBAC module recovers real type safety from it). Kept as a
 * named alias purely for readability: every `role` field below is really
 * just a `string` the adapter's own database enforces the shape of.
 */
export type RoleName = string;
export type MfaPurpose = "SIGN_IN" | "ENABLE" | "DISABLE";

export interface AdapterAuthUser {
  id: string;
  email: string;
  name: string | null;
  role: RoleName;
  passwordHash: string;
  disabledAt: Date | null;
  mfaEnabled: boolean;
}

export interface AdapterBasicUser {
  id: string;
  email: string;
  name: string | null;
  role: RoleName;
  passwordHash: string;
}

export interface AdapterSessionUser {
  id: string;
  email: string;
  name: string | null;
  role: RoleName;
  disabledAt: Date | null;
  passwordHash: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
}

export interface AdapterSessionWithUser {
  expiresAt: Date;
  revokedAt: Date | null;
  mfaVerified: boolean;
  user: AdapterSessionUser;
}

export interface AdapterSessionRow {
  id: string;
  userId: string;
  ip: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  mfaVerified: boolean;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  userEmail: string;
  userName: string | null;
}

export interface PermissionRow {
  // Not `RoleName`: rows come from the database, and `matrixFromRows`
  // (rbac/rules.ts) defensively drops rows whose role or permission it does
  // not recognize rather than trusting stored data to match the current code.
  role: string;
  permission: string;
}

export interface AdapterMfaChallenge {
  id: string;
  userId: string;
  purpose: MfaPurpose;
  codeHash: string;
  attempts: number;
  verifiedAt: Date | null;
  consumedAt: Date | null;
  expiresAt: Date;
}

export interface AuthDbAdapter<TTx = unknown> {
  withTransaction<T>(fn: (tx: TTx) => Promise<T>): Promise<T>;

  // -- users --
  findUserForAuth(email: string): Promise<AdapterAuthUser | null>;
  findUserById(id: string): Promise<AdapterBasicUser | null>;
  updateLastLoginAt(userId: string, when: Date): Promise<void>;
  countUsers(): Promise<number>;

  // -- sessions --
  createUserSession(input: {
    userId: string;
    ip: string | null;
    userAgent: string | null;
    browser: string | null;
    os: string | null;
    device: string | null;
    mfaVerified: boolean;
    expiresAt: Date;
  }): Promise<{ id: string }>;
  findFirstSessionByFingerprint(input: {
    userId: string;
    ip: string | null;
    browser: string | null;
    os: string | null;
  }): Promise<{ id: string } | null>;
  findSessionWithUser(sid: string): Promise<AdapterSessionWithUser | null>;
  touchSession(sid: string, when: Date): Promise<void>;
  findActiveSessionIds(userId: string): Promise<string[]>;
  revokeSessionById(sid: string, revokedById: string | null, reason: string): Promise<{ count: number }>;
  findActiveSessionIdsExcept(userId: string, exceptSid?: string): Promise<string[]>;
  revokeSessionsByIds(ids: string[], revokedById: string | null, reason: string): Promise<void>;
  findAllActiveSessions(exceptUserId?: string): Promise<{ id: string; userId: string }[]>;
  findRecentSessionIps(take: number): Promise<{ ip: string; lastSeenAt: Date; userEmail: string }[]>;
  findSessionsList(options: { userId?: string; includeEnded?: boolean; take: number }): Promise<AdapterSessionRow[]>;

  // -- rbac --
  findAllRolePermissions(): Promise<PermissionRow[]>;
  deleteRolePermissions(roles: RoleName[], tx?: TTx): Promise<void>;
  createRolePermissions(rows: { role: RoleName; permission: string; updatedById: string }[], tx?: TTx): Promise<void>;

  // -- mfa --
  findOpenMfaChallenges(userId: string, purpose: MfaPurpose, now: Date): Promise<{ attempts: number; expiresAt: Date }[]>;
  expireOpenMfaChallenges(userId: string, purpose: MfaPurpose, now: Date, tx?: TTx): Promise<void>;
  createMfaChallenge(
    input: { id: string; userId: string; purpose: MfaPurpose; codeHash: string; attempts: number; expiresAt: Date },
    tx?: TTx
  ): Promise<void>;
  expireMfaChallengeById(id: string, when: Date): Promise<void>;
  findMfaChallengeById(id: string, userId: string, purpose: MfaPurpose): Promise<AdapterMfaChallenge | null>;
  incrementMfaAttempts(id: string, now: Date, maxAttempts: number): Promise<{ count: number }>;
  findMfaChallengeAttempts(id: string): Promise<{ attempts: number } | null>;
  markMfaChallengeVerified(id: string, when: Date): Promise<void>;
  consumeMfaChallenge(input: { id: string; userId: string; purpose: MfaPurpose; now: Date; verifiedWindowSeconds: number }): Promise<{ count: number }>;
  findMfaChallengeOwner(
    id: string,
    purpose: MfaPurpose
  ): Promise<{ userId: string; user: { id: string; email: string; name: string | null; disabledAt: Date | null } } | null>;
}
