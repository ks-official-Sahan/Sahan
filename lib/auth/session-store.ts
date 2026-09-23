import "server-only";

import { kv } from "@/lib/cache/redis";
import { getEnv } from "@/lib/env";
import { createSessionStore } from "@sahan/auth-kit/session";

import { prismaAuthAdapter } from "./prisma-adapter";

// Server side of a session: the Postgres row is the authority, Redis holds a
// 30 second copy of its state so most requests skip the database. Section 6.3 of
// docs/plan/admin-cms-adr.md.

const authSecret = getEnv().AUTH_SECRET;
if (!authSecret) throw new Error("AUTH_SECRET is not set");

export const {
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
} = createSessionStore({ adapter: prismaAuthAdapter, kv, authSecret });

export type { KnownIp, NewSession, Revoker, SessionListItem } from "@sahan/auth-kit/session";
