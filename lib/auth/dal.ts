import "server-only";

import { createAuthDal } from "@sahan/auth-kit/session";

import { auth } from "./config";
import { getRolePermissions } from "./rbac";
import { getSessionState, touchSession } from "./session-store";

// Data access layer: the one place that decides who is signed in. The proxy and
// the layouts only make optimistic checks, so every admin page, server action and
// route handler calls in here (docs/plan/admin-cms-adr.md, section 6.1).

export const { getOptionalUser, requireUser, getSessionStatus, hasPermission, requirePermission } = createAuthDal({
  auth,
  getSessionState,
  touchSession,
  getRolePermissions,
});

export type { AuthUser } from "@sahan/auth-kit/session";
