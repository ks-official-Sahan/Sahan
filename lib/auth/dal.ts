import "server-only";

import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";

import { auth } from "./config";
import { EXPIRE_PATH } from "./constants";
import type { Permission, RoleName } from "./permissions";
import { getRolePermissions } from "./rbac";
import { evaluateSession, type SessionDenial } from "./session-state";
import { getSessionState, touchSession } from "./session-store";

// Data access layer: the one place that decides who is signed in. The proxy and
// the layouts only make optimistic checks, so every admin page, server action and
// route handler calls in here (docs/plan/admin-cms-adr.md, section 6.1).

export interface AuthUser {
  id: string;
  sid: string;
  email: string;
  name: string | null;
  role: RoleName;
  permissions: readonly Permission[];
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  mfaVerified: boolean;
}

type Resolved = { user: AuthUser } | { denied: SessionDenial | "no_session" };

// One lookup per request, however many components ask.
const resolve = cache(async (): Promise<Resolved> => {
  const session = await auth();
  if (!session?.sid) return { denied: "no_session" };

  const state = await getSessionState(session.sid);
  const verdict = evaluateSession(state, { sub: session.user?.id, pwf: session.pwf }, Date.now());
  if (!verdict.ok || !state) return { denied: verdict.ok ? "missing" : verdict.reason };

  const permissions = await getRolePermissions(state.role);
  after(() => touchSession(session.sid).catch(() => undefined));

  return {
    user: {
      id: state.userId,
      sid: session.sid,
      email: state.email,
      name: state.name,
      role: state.role,
      permissions,
      mustChangePassword: state.mustChangePassword,
      mfaEnabled: state.mfaEnabled,
      mfaVerified: state.mfaVerified,
    },
  };
});

/** The signed-in user, or null. Never redirects. */
export async function getOptionalUser(): Promise<AuthUser | null> {
  const result = await resolve();
  return "user" in result ? result.user : null;
}

/**
 * The signed-in user. A request that reaches an admin page without any valid
 * session ends as the public 404. A session that exists but no longer counts
 * (revoked, expired, disabled, password changed) goes to the route that clears
 * the cookie, because a Server Component cannot write cookies.
 */
export async function requireUser(): Promise<AuthUser> {
  const result = await resolve();
  if ("user" in result) return result.user;
  if (result.denied === "no_session") notFound();
  redirect(EXPIRE_PATH);
}

export function hasPermission(user: Pick<AuthUser, "permissions">, permission: Permission): boolean {
  return user.permissions.includes(permission);
}

/** For pages: a missing permission looks like a missing page. */
export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await requireUser();
  if (!hasPermission(user, permission)) notFound();
  return user;
}
