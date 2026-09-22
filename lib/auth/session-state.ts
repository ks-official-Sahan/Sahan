import { createHmac } from "node:crypto";

import { constantTimeEqual } from "@/lib/admin/login-unlock";

import type { RoleName } from "./permissions";

// What the server knows about a session, and the rule that turns it into a yes
// or no. Kept free of database and cache code so the rule is unit tested
// (docs/plan/admin-cms-adr.md, section 6.3).

export interface SessionState {
  userId: string;
  email: string;
  name: string | null;
  role: RoleName;
  disabled: boolean;
  revoked: boolean;
  /** Epoch milliseconds. */
  expiresAt: number;
  /** Fingerprint of the stored password hash at the time the state was read. */
  pwf: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  mfaVerified: boolean;
}

export type SessionDenial =
  | "missing"
  | "user_mismatch"
  | "revoked"
  | "expired"
  | "disabled"
  | "password_changed";

export type SessionVerdict = { ok: true } | { ok: false; reason: SessionDenial };

/**
 * First 16 hex characters of HMAC-SHA256(AUTH_SECRET, passwordHash). It goes into
 * the JWT as `pwf`, so changing the password ends every older session, and it is
 * derived, so the hash itself never leaves the database.
 */
export function passwordFingerprint(passwordHash: string, authSecret: string): string {
  return createHmac("sha256", authSecret).update(passwordHash).digest("hex").slice(0, 16);
}

export function evaluateSession(
  state: SessionState | null,
  claims: { sub: string | undefined; pwf: string | undefined },
  now: number
): SessionVerdict {
  if (!state) return { ok: false, reason: "missing" };
  if (!claims.sub || claims.sub !== state.userId) return { ok: false, reason: "user_mismatch" };
  if (state.revoked) return { ok: false, reason: "revoked" };
  if (state.expiresAt <= now) return { ok: false, reason: "expired" };
  if (state.disabled) return { ok: false, reason: "disabled" };
  if (!claims.pwf || !constantTimeEqual(claims.pwf, state.pwf)) {
    return { ok: false, reason: "password_changed" };
  }
  return { ok: true };
}
