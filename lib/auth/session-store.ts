import "server-only";

import { userAgent } from "next/server";

import { kv } from "@/lib/cache/redis";
import { db } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";

import { SESSION_MAX_AGE_SECONDS } from "./constants";
import type { RoleName } from "./permissions";
import { passwordFingerprint, type SessionState } from "./session-state";

// Server side of a session: the Postgres row is the authority, Redis holds a
// 30 second copy of its state so most requests skip the database. Section 6.3 of
// docs/plan/admin-cms-adr.md.

const STATE_TTL_SECONDS = 30;
const TOUCH_INTERVAL_SECONDS = 60;

const stateKey = (sid: string) => `sahan:sess:v1:${sid}`;
const touchKey = (sid: string) => `sahan:sess:touch:${sid}`;

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

/**
 * State of a session, or null when no such session exists. A Redis error falls
 * back to the database. A database error is thrown: the caller must not treat
 * "cannot tell" as "signed in", and must not sign the user out for it either.
 */
export async function getSessionState(sid: string): Promise<SessionState | null> {
  try {
    const cached = await kv.get<SessionState>(stateKey(sid));
    if (cached && typeof cached === "object" && cached.userId) return cached;
  } catch {
    // fall through to the database
  }

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

  const state: SessionState = {
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
  await kv.set(stateKey(sid), state, { ttlSeconds: STATE_TTL_SECONDS }).catch(() => undefined);
  return state;
}

/** Forgets the cached state, so the next request reads the database. */
export async function invalidateSessionState(...sids: string[]): Promise<void> {
  if (sids.length === 0) return;
  await kv.del(...sids.map(stateKey)).catch(() => undefined);
}

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

export async function revokeSession(
  sid: string,
  by: { userId: string | null; reason: string }
): Promise<boolean> {
  const result = await db.userSession.updateMany({
    where: { id: sid, revokedAt: null },
    data: { revokedAt: new Date(), revokedById: by.userId, revokeReason: by.reason },
  });
  await invalidateSessionState(sid);
  return result.count > 0;
}
