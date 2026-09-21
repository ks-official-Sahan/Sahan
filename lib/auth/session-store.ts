import "server-only";

import { userAgent } from "next/server";

import { kv } from "@/lib/cache/redis";
import { db } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";

import { SESSION_MAX_AGE_SECONDS } from "./constants";
import type { RoleName } from "./permissions";
import { createSessionReader } from "./session-reader";
import { passwordFingerprint, type SessionState } from "./session-state";

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

function describeAgent(ua: string | null) {
  if (!ua) return { browser: null, os: null, device: null };
  const parsed = userAgent({ headers: new Headers({ "user-agent": ua }) });
  return {
    browser: parsed.browser.name ?? null,
    os: parsed.os.name ?? null,
    device: parsed.device.type ?? "desktop",
  };
}

/** Creates the row that a JWT with this `sid` refers to. */
export async function createSession(input: NewSession): Promise<{ id: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const row = await db.userSession.create({
    data: {
      userId: input.userId,
      ip: input.ip,
      userAgent: input.userAgent?.slice(0, 1024) ?? null,
      ...describeAgent(input.userAgent),
      mfaVerified: input.mfaVerified ?? false,
      expiresAt,
    },
    select: { id: true },
  });
  return { id: row.id, expiresAt };
}

/** True when this user has signed in before from the same address, browser and system. */
export async function isKnownDevice(userId: string, ip: string | null, ua: string | null): Promise<boolean> {
  const { browser, os } = describeAgent(ua);
  const found = await db.userSession.findFirst({
    where: { userId, ip, browser, os },
    select: { id: true },
  });
  return found !== null;
}

async function loadFromDatabase(sid: string): Promise<SessionState | null> {
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
        },
      },
    },
  });
  if (!row) return null;

  const authSecret = getEnv().AUTH_SECRET;
  if (!authSecret) throw new Error("AUTH_SECRET is not set");

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

/**
 * State of a session, or null when no such session exists. A Redis error falls
 * back to the database. A database error is thrown: the caller must not treat
 * "cannot tell" as "signed in", and must not sign the user out for it either.
 */
export const getSessionState = reader.get;

/** Forgets the cached state, so the next request reads the database. */
export const invalidateSessionState = reader.invalidate;

/** Records activity at most once a minute per session. */
export async function touchSession(sid: string): Promise<void> {
  try {
    const first = await kv.set(touchKey(sid), 1, { ttlSeconds: TOUCH_INTERVAL_SECONDS, nx: true });
    if (!first) return;
  } catch {
    // No gate available: skip the write rather than write on every request.
    return;
  }
  await db.userSession.updateMany({
    where: { id: sid, revokedAt: null },
    data: { lastSeenAt: new Date() },
  });
}

/** Drops the cached state of every session of a user, so a role or status change applies at once. */
export async function invalidateUserSessionState(userId: string): Promise<void> {
  const rows = await db.userSession.findMany({ where: { userId, revokedAt: null }, select: { id: true } });
  if (rows.length > 0) await invalidateSessionState(...rows.map((row) => row.id));
}

export interface Revoker {
  userId: string | null;
  reason: string;
}

export async function revokeSession(sid: string, by: Revoker): Promise<boolean> {
  const result = await db.userSession.updateMany({
    where: { id: sid, revokedAt: null },
    data: { revokedAt: new Date(), revokedById: by.userId, revokeReason: by.reason },
  });
  await invalidateSessionState(sid);
  return result.count > 0;
}

/** Ends every active session of a user, optionally keeping one. Returns the ids it ended. */
export async function revokeUserSessions(
  userId: string,
  by: Revoker,
  options: { exceptSid?: string } = {}
): Promise<string[]> {
  const active = await db.userSession.findMany({
    where: { userId, revokedAt: null, ...(options.exceptSid ? { id: { not: options.exceptSid } } : {}) },
    select: { id: true },
  });
  const ids = active.map((row) => row.id);
  if (ids.length === 0) return [];
  await db.userSession.updateMany({
    where: { id: { in: ids }, revokedAt: null },
    data: { revokedAt: new Date(), revokedById: by.userId, revokeReason: by.reason },
  });
  await invalidateSessionState(...ids);
  return ids;
}

/** Ends every active session of everyone, optionally keeping every session of one user (the caller). */
export async function forceLogoutAll(
  by: Revoker,
  options: { exceptUserId?: string } = {}
): Promise<{ sessions: number; users: number; userIds: string[] }> {
  const active = await db.userSession.findMany({
    where: { revokedAt: null, expiresAt: { gt: new Date() }, ...(options.exceptUserId ? { userId: { not: options.exceptUserId } } : {}) },
    select: { id: true, userId: true },
  });
  const ids = active.map((row) => row.id);
  if (ids.length > 0) {
    await db.userSession.updateMany({
      where: { id: { in: ids }, revokedAt: null },
      data: { revokedAt: new Date(), revokedById: by.userId, revokeReason: by.reason },
    });
    await invalidateSessionState(...ids);
  }
  const userIds = [...new Set(active.map((row) => row.userId))];
  return { sessions: ids.length, users: userIds.length, userIds };
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

/** Active sessions, or with `includeEnded` the last week of ended ones too. Newest activity first. */
export async function listSessions(options: {
  userId?: string;
  includeEnded?: boolean;
  limit?: number;
} = {}): Promise<SessionListItem[]> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const rows = await db.userSession.findMany({
    where: {
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.includeEnded
        ? { OR: [{ revokedAt: null, expiresAt: { gt: now } }, { lastSeenAt: { gte: weekAgo } }] }
        : { revokedAt: null, expiresAt: { gt: now } }),
    },
    orderBy: { lastSeenAt: "desc" },
    take: Math.min(options.limit ?? 100, 500),
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
}
