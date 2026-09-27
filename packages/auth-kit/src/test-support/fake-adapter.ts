import { randomUUID } from "node:crypto";

import type {
  AdapterAuthUser,
  AdapterMfaChallenge,
  AdapterSessionRow,
  AdapterSessionWithUser,
  AuthDbAdapter,
  MfaPurpose,
  PermissionRow,
  RoleName,
} from "../adapter";

// A tiny, in-memory `AuthDbAdapter` for unit tests: enough of the users,
// sessions, RBAC rows and MFA challenges tables to exercise
// createSessionStore/createMfa/createRbac/createAuthConfig's `authorize`
// without a real database, and with `withTransaction` genuinely atomic (an
// in-process snapshot/restore on throw) so the transaction contract itself
// (RBAC's delete+insert+audit as one unit) is exercised too. Not exported
// from the package — this lives under src/ only so the *.test.ts files that
// import it are picked up by the same `src/**/*.test.ts` glob, but this file
// itself is not a test.

export interface FakeUser {
  id: string;
  email: string;
  name: string | null;
  role: RoleName;
  passwordHash: string;
  disabledAt: Date | null;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
}

export interface FakeSession {
  id: string;
  userId: string;
  ip: string | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  mfaVerified: boolean;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedById: string | null;
  revokeReason: string | null;
}

export interface FakeMfaChallenge {
  id: string;
  userId: string;
  purpose: MfaPurpose;
  codeHash: string;
  attempts: number;
  verifiedAt: Date | null;
  consumedAt: Date | null;
  expiresAt: Date;
}

interface State {
  users: Map<string, FakeUser>;
  sessions: Map<string, FakeSession>;
  rolePermissions: PermissionRow[];
  mfaChallenges: Map<string, FakeMfaChallenge>;
}

function cloneState(state: State): State {
  return {
    users: new Map([...state.users].map(([id, user]) => [id, { ...user }])),
    sessions: new Map([...state.sessions].map(([id, session]) => [id, { ...session }])),
    rolePermissions: state.rolePermissions.map((row) => ({ ...row })),
    mfaChallenges: new Map([...state.mfaChallenges].map(([id, challenge]) => [id, { ...challenge }])),
  };
}

export class FakeAdapter implements AuthDbAdapter<undefined> {
  private state: State = { users: new Map(), sessions: new Map(), rolePermissions: [], mfaChallenges: new Map() };

  // -- test setup helpers (not part of AuthDbAdapter) --

  addUser(user: Partial<FakeUser> & Pick<FakeUser, "email" | "passwordHash" | "role">): FakeUser {
    const full: FakeUser = {
      id: user.id ?? randomUUID(),
      email: user.email,
      name: user.name ?? null,
      role: user.role,
      passwordHash: user.passwordHash,
      disabledAt: user.disabledAt ?? null,
      mfaEnabled: user.mfaEnabled ?? false,
      mustChangePassword: user.mustChangePassword ?? false,
      lastLoginAt: user.lastLoginAt ?? null,
    };
    this.state.users.set(full.id, full);
    return full;
  }

  getUser(id: string): FakeUser | undefined {
    return this.state.users.get(id);
  }

  getSession(id: string): FakeSession | undefined {
    return this.state.sessions.get(id);
  }

  setRolePermissions(rows: PermissionRow[]): void {
    this.state.rolePermissions = rows;
  }

  // -- AuthDbAdapter --

  async withTransaction<T>(fn: (tx: undefined) => Promise<T>): Promise<T> {
    const snapshot = cloneState(this.state);
    try {
      return await fn(undefined);
    } catch (error) {
      this.state = snapshot; // roll back, same as a real database transaction would
      throw error;
    }
  }

  async findUserForAuth(email: string): Promise<AdapterAuthUser | null> {
    const user = [...this.state.users.values()].find((candidate) => candidate.email === email);
    return user
      ? { id: user.id, email: user.email, name: user.name, role: user.role, passwordHash: user.passwordHash, disabledAt: user.disabledAt, mfaEnabled: user.mfaEnabled }
      : null;
  }

  async findUserById(id: string) {
    const user = this.state.users.get(id);
    return user ? { id: user.id, email: user.email, name: user.name, role: user.role, passwordHash: user.passwordHash } : null;
  }

  async updateLastLoginAt(userId: string, when: Date): Promise<void> {
    const user = this.state.users.get(userId);
    if (user) user.lastLoginAt = when;
  }

  async countUsers(): Promise<number> {
    return this.state.users.size;
  }

  async createUserSession(input: {
    userId: string;
    ip: string | null;
    userAgent: string | null;
    browser: string | null;
    os: string | null;
    device: string | null;
    mfaVerified: boolean;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    const id = randomUUID();
    const now = new Date();
    this.state.sessions.set(id, {
      id,
      userId: input.userId,
      ip: input.ip,
      userAgent: input.userAgent,
      browser: input.browser,
      os: input.os,
      device: input.device,
      mfaVerified: input.mfaVerified,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: input.expiresAt,
      revokedAt: null,
      revokedById: null,
      revokeReason: null,
    });
    return { id };
  }

  async findFirstSessionByFingerprint(input: { userId: string; ip: string | null; browser: string | null; os: string | null }) {
    const found = [...this.state.sessions.values()].find(
      (session) => session.userId === input.userId && session.ip === input.ip && session.browser === input.browser && session.os === input.os
    );
    return found ? { id: found.id } : null;
  }

  async findSessionWithUser(sid: string): Promise<AdapterSessionWithUser | null> {
    const session = this.state.sessions.get(sid);
    if (!session) return null;
    const user = this.state.users.get(session.userId);
    if (!user) return null;
    return {
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      mfaVerified: session.mfaVerified,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        disabledAt: user.disabledAt,
        passwordHash: user.passwordHash,
        mustChangePassword: user.mustChangePassword,
        mfaEnabled: user.mfaEnabled,
      },
    };
  }

  async touchSession(sid: string, when: Date): Promise<void> {
    const session = this.state.sessions.get(sid);
    if (session && !session.revokedAt) session.lastSeenAt = when;
  }

  async findActiveSessionIds(userId: string): Promise<string[]> {
    return [...this.state.sessions.values()].filter((session) => session.userId === userId && !session.revokedAt).map((session) => session.id);
  }

  async revokeSessionById(sid: string, revokedById: string | null, reason: string): Promise<{ count: number }> {
    const session = this.state.sessions.get(sid);
    if (!session || session.revokedAt) return { count: 0 };
    session.revokedAt = new Date();
    session.revokedById = revokedById;
    session.revokeReason = reason;
    return { count: 1 };
  }

  async findActiveSessionIdsExcept(userId: string, exceptSid?: string): Promise<string[]> {
    return [...this.state.sessions.values()]
      .filter((session) => session.userId === userId && !session.revokedAt && session.id !== exceptSid)
      .map((session) => session.id);
  }

  async revokeSessionsByIds(ids: string[], revokedById: string | null, reason: string): Promise<void> {
    for (const id of ids) {
      const session = this.state.sessions.get(id);
      if (session && !session.revokedAt) {
        session.revokedAt = new Date();
        session.revokedById = revokedById;
        session.revokeReason = reason;
      }
    }
  }

  async findAllActiveSessions(exceptUserId?: string): Promise<{ id: string; userId: string }[]> {
    return [...this.state.sessions.values()]
      .filter((session) => !session.revokedAt && session.userId !== exceptUserId)
      .map((session) => ({ id: session.id, userId: session.userId }));
  }

  async findRecentSessionIps(take: number): Promise<{ ip: string; lastSeenAt: Date; userEmail: string }[]> {
    return [...this.state.sessions.values()]
      .filter((session): session is FakeSession & { ip: string } => session.ip !== null)
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .slice(0, take)
      .map((session) => ({ ip: session.ip, lastSeenAt: session.lastSeenAt, userEmail: this.state.users.get(session.userId)?.email ?? "" }));
  }

  async findSessionsList(options: { userId?: string; includeEnded?: boolean; take: number }): Promise<AdapterSessionRow[]> {
    return [...this.state.sessions.values()]
      .filter((session) => (options.userId ? session.userId === options.userId : true))
      .filter((session) => (options.includeEnded ? true : !session.revokedAt))
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .slice(0, options.take)
      .map((session) => {
        const user = this.state.users.get(session.userId);
        return {
          id: session.id,
          userId: session.userId,
          ip: session.ip,
          browser: session.browser,
          os: session.os,
          device: session.device,
          mfaVerified: session.mfaVerified,
          createdAt: session.createdAt,
          lastSeenAt: session.lastSeenAt,
          expiresAt: session.expiresAt,
          revokedAt: session.revokedAt,
          revokeReason: session.revokeReason,
          userEmail: user?.email ?? "",
          userName: user?.name ?? null,
        };
      });
  }

  async findAllRolePermissions(): Promise<PermissionRow[]> {
    return this.state.rolePermissions.map((row) => ({ ...row }));
  }

  async deleteRolePermissions(roles: RoleName[]): Promise<void> {
    this.state.rolePermissions = this.state.rolePermissions.filter((row) => !roles.includes(row.role));
  }

  async createRolePermissions(rows: { role: RoleName; permission: string; updatedById: string }[]): Promise<void> {
    this.state.rolePermissions.push(...rows.map((row) => ({ role: row.role, permission: row.permission })));
  }

  async findOpenMfaChallenges(userId: string, purpose: MfaPurpose, now: Date): Promise<{ attempts: number; expiresAt: Date }[]> {
    return [...this.state.mfaChallenges.values()]
      .filter((challenge) => challenge.userId === userId && challenge.purpose === purpose && !challenge.consumedAt && challenge.expiresAt > now)
      .map((challenge) => ({ attempts: challenge.attempts, expiresAt: challenge.expiresAt }));
  }

  async expireOpenMfaChallenges(userId: string, purpose: MfaPurpose, now: Date): Promise<void> {
    for (const challenge of this.state.mfaChallenges.values()) {
      if (challenge.userId === userId && challenge.purpose === purpose && !challenge.consumedAt && challenge.expiresAt > now) {
        challenge.expiresAt = now;
      }
    }
  }

  async createMfaChallenge(input: { id: string; userId: string; purpose: MfaPurpose; codeHash: string; attempts: number; expiresAt: Date }): Promise<void> {
    this.state.mfaChallenges.set(input.id, { ...input, verifiedAt: null, consumedAt: null });
  }

  async expireMfaChallengeById(id: string, when: Date): Promise<void> {
    const challenge = this.state.mfaChallenges.get(id);
    if (challenge) challenge.expiresAt = when;
  }

  async findMfaChallengeById(id: string, userId: string, purpose: MfaPurpose): Promise<AdapterMfaChallenge | null> {
    const challenge = this.state.mfaChallenges.get(id);
    if (!challenge || challenge.userId !== userId || challenge.purpose !== purpose) return null;
    return { ...challenge };
  }

  async incrementMfaAttempts(id: string, now: Date, maxAttempts: number): Promise<{ count: number }> {
    const challenge = this.state.mfaChallenges.get(id);
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= now || challenge.attempts >= maxAttempts) return { count: 0 };
    challenge.attempts += 1;
    return { count: 1 };
  }

  async findMfaChallengeAttempts(id: string): Promise<{ attempts: number } | null> {
    const challenge = this.state.mfaChallenges.get(id);
    return challenge ? { attempts: challenge.attempts } : null;
  }

  async markMfaChallengeVerified(id: string, when: Date): Promise<void> {
    const challenge = this.state.mfaChallenges.get(id);
    if (challenge && !challenge.verifiedAt) challenge.verifiedAt = when;
  }

  async consumeMfaChallenge(input: { id: string; userId: string; purpose: MfaPurpose; now: Date; verifiedWindowSeconds: number }): Promise<{ count: number }> {
    const challenge = this.state.mfaChallenges.get(input.id);
    if (
      !challenge ||
      challenge.userId !== input.userId ||
      challenge.purpose !== input.purpose ||
      challenge.consumedAt ||
      !challenge.verifiedAt ||
      challenge.verifiedAt.getTime() < input.now.getTime() - input.verifiedWindowSeconds * 1000 ||
      challenge.expiresAt <= input.now
    ) {
      return { count: 0 };
    }
    challenge.consumedAt = input.now;
    return { count: 1 };
  }

  async findMfaChallengeOwner(id: string, purpose: MfaPurpose) {
    const challenge = this.state.mfaChallenges.get(id);
    if (!challenge || challenge.purpose !== purpose || challenge.consumedAt) return null;
    const user = this.state.users.get(challenge.userId);
    if (!user) return null;
    return { userId: user.id, user: { id: user.id, email: user.email, name: user.name, disabledAt: user.disabledAt } };
  }
}
