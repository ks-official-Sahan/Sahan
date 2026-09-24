import { cache } from "react";

import type { Permission, RoleName } from "../rbac/permissions";
import { evaluateSession, type SessionDenial, type SessionState } from "./state";

// Data access layer: the one place that decides who is signed in. The proxy and
// the layouts only make optimistic checks, so every admin page, server action and
// route handler calls in here.

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
  /**
   * `next/navigation`'s `notFound`/`redirect`, injected rather than imported
   * directly: both throw a special, framework-recognized error to end
   * rendering, so this module takes them as dependencies the same way it
   * takes every other framework touchpoint, and a test can pass throwing
   * stubs instead of needing a real Next.js render context.
   */
  notFound: () => never;
  redirect: (path: string) => never;
  /**
   * `next/server`'s `after`, injected for the same reason: it throws
   * "called outside a request scope" outside a real Next.js request, which a
   * unit test is not.
   */
  after: (fn: () => void) => void;
  /** Route Handler that clears a revoked/expired/disabled session's cookie. For example `"/api/auth/expire"`. */
  expirePath: string;
  /** Where a user with `mustChangePassword` is sent until they choose their own password. */
  accountPasswordChangePath: string;
}

export function createAuthDal(deps: AuthDalDeps) {
  const { auth, getSessionState, touchSession, getRolePermissions, notFound, redirect, after, expirePath, accountPasswordChangePath } = deps;

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
      redirect(expirePath);
      // notFound()/redirect() are typed `never` but, being parameters rather
      // than declared functions, TypeScript's control-flow analysis does not
      // treat a call through them as unconditionally terminating (unlike a
      // direct `declare function notFound(): never`). Both always throw in
      // practice; this line only exists to satisfy that narrowing so
      // `result.user` below is legally reachable.
      throw new Error("unreachable: notFound()/redirect() must throw");
    }
    // A user whose password was set by someone else (the seeded owner, an admin
    // reset) can reach nothing but the account page until they choose their own.
    if (result.user.mustChangePassword && !options.allowPasswordChange) redirect(accountPasswordChangePath);
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
