import { userAgent } from "next/server";

import type { AuthDbAdapter } from "../adapter";
import type { Kv } from "../cache/memory";
import { SESSION_MAX_AGE_SECONDS } from "../constants";
import type { RoleName } from "../rbac/permissions";
import { createSessionReader } from "./reader";
import { passwordFingerprint, type SessionState } from "./state";

// Server side of a session: the Postgres row is the authority, Redis holds a
// 30 second copy of its state so most requests skip the database. Section 6.3 of
// docs/plan/admin-cms-adr.md.

const STATE_TTL_SECONDS = 30;
const TOUCH_INTERVAL_SECONDS = 60;

const stateKey = (sid: string) => `sess:v1:${sid}`;
const touchKey = (sid: string) => `sess:touch:${sid}`;

export interface NewSession {
  userId: string;
  ip: string | null;
  userAgent: string | null;
  mfaVerified?: boolean;
}

export interface Revoker {
  userId: string | null;
  reason: string;
}

export interface KnownIp {
  ip: string;
  lastSeenAt: Date;
  userEmail: string;
}

export interface SessionListItem {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
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
}

function describeAgent(ua: string | null) {
  if (!ua) return { browser: null, os: null, device: null };
  const parsed = userAgent({ headers: new Headers({ "user-agent": ua }) });
  return {
    browser: parsed.browser.name ?? null,
    os: parsed.os.name ?? null,
    device: parsed.device.type ?? "desktop",
  };
}

export function createSessionStore(deps: { adapter: AuthDbAdapter; kv: Kv; authSecret: string }) {
  const { adapter, kv, authSecret } = deps;

  async function loadFromDatabase(sid: string): Promise<SessionState | null> {
    const row = await adapter.findSessionWithUser(sid);
    if (!row) return null;
    return {
      userId: row.user.id,
      email: row.user.email,
      name: row.user.name,
      role: row.user.role as RoleName,
      disabled: row.user.disabledAt !== null,
      revoked: row.revokedAt !== null,
      expiresAt: row.expiresAt.getTime(),
      pwf: passwordFingerprint(row.user.passwordHash, authSecret),
      mustChangePassword: row.user.mustChangePassword,
      mfaEnabled: row.user.mfaEnabled,
      mfaVerified: row.mfaVerified,
    };
  }

  const reader = createSessionReader({
    cache: {
      get: (sid) => kv.get<SessionState>(stateKey(sid)).then((value) => (value && typeof value === "object" && value.userId ? value : null)),
      set: async (sid, state) => void (await kv.set(stateKey(sid), state, { ttlSeconds: STATE_TTL_SECONDS })),
      del: async (...sids) => void (await kv.del(...sids.map(stateKey))),
    },
    load: loadFromDatabase,
  });

  /** Creates the row that a JWT with this `sid` refers to. */
  async function createSession(input: NewSession): Promise<{ id: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
    const agent = describeAgent(input.userAgent);
    const row = await adapter.createUserSession({
      userId: input.userId,
      ip: input.ip,
      userAgent: input.userAgent?.slice(0, 1024) ?? null,
      browser: agent.browser,
      os: agent.os,
      device: agent.device,
      mfaVerified: input.mfaVerified ?? false,
      expiresAt,
    });
    return { id: row.id, expiresAt };
  }

  /** True when this user has signed in before from the same address, browser and system. */
  async function isKnownDevice(userId: string, ip: string | null, ua: string | null): Promise<boolean> {
    const { browser, os } = describeAgent(ua);
    const found = await adapter.findFirstSessionByFingerprint({ userId, ip, browser, os });
    return found !== null;
  }

  /**
   * State of a session, or null when no such session exists. A Redis error falls
   * back to the database. A database error is thrown: the caller must not treat
   * "cannot tell" as "signed in", and must not sign the user out for it either.
   */
  const getSessionState = reader.get;

  /** Forgets the cached state, so the next request reads the database. */
  const invalidateSessionState = reader.invalidate;

  /** Records activity at most once a minute per session. */
  async function touchSession(sid: string): Promise<void> {
    try {
      const first = await kv.set(touchKey(sid), 1, { ttlSeconds: TOUCH_INTERVAL_SECONDS, nx: true });
      if (!first) return;
    } catch {
      // No gate available: skip the write rather than write on every request.
      return;
    }
    await adapter.touchSession(sid, new Date());
  }

  /** Drops the cached state of every session of a user, so a role or status change applies at once. */
  async function invalidateUserSessionState(userId: string): Promise<void> {
    const ids = await adapter.findActiveSessionIds(userId);
    if (ids.length > 0) await invalidateSessionState(...ids);
  }

  async function revokeSession(sid: string, by: Revoker): Promise<boolean> {
    const result = await adapter.revokeSessionById(sid, by.userId, by.reason);
    await invalidateSessionState(sid);
    return result.count > 0;
  }

  /** Ends every active session of a user, optionally keeping one. Returns the ids it ended. */
  async function revokeUserSessions(userId: string, by: Revoker, options: { exceptSid?: string } = {}): Promise<string[]> {
    const ids = await adapter.findActiveSessionIdsExcept(userId, options.exceptSid);
    if (ids.length === 0) return [];
    await adapter.revokeSessionsByIds(ids, by.userId, by.reason);
    await invalidateSessionState(...ids);
    return ids;
  }

  /** Ends every active session of everyone, optionally keeping every session of one user (the caller). */
  async function forceLogoutAll(
    by: Revoker,
    options: { exceptUserId?: string } = {}
  ): Promise<{ sessions: number; users: number; userIds: string[] }> {
    const active = await adapter.findAllActiveSessions(options.exceptUserId);
    const ids = active.map((row) => row.id);
    if (ids.length > 0) {
      await adapter.revokeSessionsByIds(ids, by.userId, by.reason);
      await invalidateSessionState(...ids);
    }
    const userIds = [...new Set(active.map((row) => row.userId))];
    return { sessions: ids.length, users: userIds.length, userIds };
  }

  /**
   * Distinct IPs that have actually signed in, most recently seen first. Backs
   * the IP allowlist form so the owner can pick from real sign-in history
   * instead of typing an address from memory (docs/plan/admin-cms-adr.md,
   * section 6.7 / R22). Reads `UserSession.ip`, which is only ever set to a
   * resolved address (never UNKNOWN_IP, see lib/auth/config.ts's `knownIp`),
   * so every entry here is a real, previously-seen caller.
   */
  async function getKnownIps(limit = 20): Promise<KnownIp[]> {
    const rows = await adapter.findRecentSessionIps(Math.max(limit, 1) * 10);
    const seen = new Map<string, KnownIp>();
    for (const row of rows) {
      if (seen.has(row.ip)) continue;
      seen.set(row.ip, row);
      if (seen.size >= limit) break;
    }
    return [...seen.values()];
  }

  /** Active sessions, or with `includeEnded` the last week of ended ones too. Newest activity first. */
  async function listSessions(options: { userId?: string; includeEnded?: boolean; limit?: number } = {}): Promise<SessionListItem[]> {
    const rows = await adapter.findSessionsList({
      userId: options.userId,
      includeEnded: options.includeEnded,
      take: Math.min(options.limit ?? 100, 500),
    });
    return rows.map(({ userEmail, userName, ...row }) => ({ ...row, userEmail, userName }));
  }

  return {
    createSession,
    isKnownDevice,
    getSessionState,
    invalidateSessionState,
    touchSession,
    invalidateUserSessionState,
    revokeSession,
    revokeUserSessions,
    forceLogoutAll,
    getKnownIps,
    listSessions,
  };
}
