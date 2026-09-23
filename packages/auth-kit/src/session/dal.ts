import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";

import { ACCOUNT_PASSWORD_PATH, EXPIRE_PATH } from "../constants";
import type { Permission, RoleName } from "../rbac/permissions";
import { evaluateSession, type SessionDenial, type SessionState } from "./state";

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

export interface AuthDalDeps {
  auth: () => Promise<{ sid?: string; user?: { id?: string }; pwf?: string } | null>;
  getSessionState: (sid: string) => Promise<SessionState | null>;
  touchSession: (sid: string) => Promise<void>;
  getRolePermissions: (role: RoleName) => Promise<readonly Permission[]>;
}

export function createAuthDal(deps: AuthDalDeps) {
  const { auth, getSessionState, touchSession, getRolePermissions } = deps;

  // One lookup per request, however many components ask.
  const resolve = cache(async (): Promise<Resolved> => {
    const session = await auth();
    if (!session?.sid) return { denied: "no_session" };

    const state = await getSessionState(session.sid);
    const verdict = evaluateSession(state, { sub: session.user?.id, pwf: session.pwf }, Date.now());
    if (!verdict.ok || !state) return { denied: verdict.ok ? "missing" : verdict.reason };

    const permissions = await getRolePermissions(state.role);
    after(() => touchSession(session.sid!).catch(() => undefined));

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
  async function getOptionalUser(): Promise<AuthUser | null> {
    const result = await resolve();
    return "user" in result ? result.user : null;
  }

  /**
   * The signed-in user. A request that reaches an admin page without any valid
   * session ends as the public 404. A session that exists but no longer counts
   * (revoked, expired, disabled, password changed) goes to the route that clears
   * the cookie, because a Server Component cannot write cookies.
   */
  async function requireUser(options: { allowPasswordChange?: boolean } = {}): Promise<AuthUser> {
    const result = await resolve();
    if (!("user" in result)) {
      if (result.denied === "no_session") notFound();
      redirect(EXPIRE_PATH);
    }
    // A user whose password was set by someone else (the seeded owner, an admin
    // reset) can reach nothing but the account page until they choose their own.
    if (result.user.mustChangePassword && !options.allowPasswordChange) redirect(ACCOUNT_PASSWORD_PATH);
    return result.user;
  }

  /** For the session heartbeat: never redirects, and says why a session no longer counts. */
  async function getSessionStatus(): Promise<{ active: true } | { active: false; reason: string }> {
    const result = await resolve();
    return "user" in result ? { active: true } : { active: false, reason: result.denied };
  }

  function hasPermission(user: Pick<AuthUser, "permissions">, permission: Permission): boolean {
    return user.permissions.includes(permission);
  }

  /** For pages: a missing permission looks like a missing page. */
  async function requirePermission(permission: Permission, options: { allowPasswordChange?: boolean } = {}): Promise<AuthUser> {
    const user = await requireUser(options);
    if (!hasPermission(user, permission)) notFound();
    return user;
  }

  return { getOptionalUser, requireUser, getSessionStatus, hasPermission, requirePermission };
}
