import { createHash } from "node:crypto";

import type { AuditEvent } from "./audit-event";
import { LIMITS } from "./cache/ratelimit";

import type { RoleName } from "./rbac/permissions";

// Password check for sign-in, with every side effect passed in so the rules can
// be unit tested: per-IP and per-account limits, one bcrypt comparison for every
// outcome (a dummy hash when the user does not exist), one message for every
// failure, and an audit row. docs/plan/admin-cms-adr.md, sections 6.4 and 6.7.

/** bcrypt cost 12 hash of a throwaway string. Compared when the email is unknown. */
export const DUMMY_HASH = "$2b$12$18eHtNBfSC0yiMf1QruG3OX2KvcSMHJqVAPSttsEibbUeqM69Z18S";

export interface StoredUser {
  id: string;
  email: string;
  name: string | null;
  role: RoleName;
  passwordHash: string;
  disabledAt: Date | null;
  mfaEnabled: boolean;
}

export interface CredentialDeps {
  ensureOwner(): Promise<void>;
  findUser(email: string): Promise<StoredUser | null>;
  compare(plain: string, hash: string): Promise<boolean>;
  /** True when this IP may try again. */
  allowIp(ip: string): Promise<boolean>;
  failures: {
    /** Counts this attempt and returns how many the account has made in the window. */
    reserve(email: string): Promise<number>;
    clear(email: string): Promise<void>;
  };
  audit(event: AuditEvent): Promise<void>;
  warn(message: string, fields: Record<string, unknown>): void;
}

export interface CredentialInput {
  email: unknown;
  password: unknown;
  ip: string;
  userAgent: string | null;
}

export type CredentialFailure = "invalid" | "limited";

export type CredentialResult =
  | { ok: true; user: StoredUser }
  | { ok: false; reason: CredentialFailure };

const MAX_EMAIL = 254;
const MAX_PASSWORD = 1024;

/** Enough to correlate attempts on one address without storing what was typed. */
const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);

export async function verifyCredentials(
  input: CredentialInput,
  deps: CredentialDeps
): Promise<CredentialResult> {
  if (typeof input.email !== "string" || typeof input.password !== "string") {
    return { ok: false, reason: "invalid" };
  }
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (email.length < 3 || email.length > MAX_EMAIL || !email.includes("@")) {
    return { ok: false, reason: "invalid" };
  }
  if (password.length === 0 || password.length > MAX_PASSWORD) {
    return { ok: false, reason: "invalid" };
  }

  // A typed email that matches no account is not stored: someone may have pasted
  // a password into the wrong field. Only a fingerprint goes in the audit row.
  const fail = async (reason: string, user?: StoredUser | null): Promise<void> => {
    await deps
      .audit({
        action: "auth.login.failure",
        actor: user ? { id: user.id, email: user.email } : null,
        entityType: "User",
        entityId: user?.id ?? null,
        meta: user ? { reason } : { reason, emailFingerprint: fingerprint(email) },
        ip: input.ip,
        userAgent: input.userAgent,
      })
      .catch(() => undefined);
  };

  await deps.ensureOwner();

  // Closed on error: when a limiter cannot answer, nobody gets in. A refused
  // attempt writes no audit row (a flood would fill the table); the IP case is a
  // log line, and the account case is audited once, when the lock starts.
  let ipAllowed = false;
  try {
    ipAllowed = await deps.allowIp(input.ip);
  } catch {
    ipAllowed = false;
  }
  if (!ipAllowed) {
    deps.warn("sign-in refused: address limit", { ip: input.ip });
    return { ok: false, reason: "limited" };
  }

  // The attempt is counted before the password is checked, so parallel requests
  // cannot each read "still under the limit" and all get a guess.
  const max: number = LIMITS["login:acct"].max;
  let attempts = Number.POSITIVE_INFINITY;
  try {
    attempts = await deps.failures.reserve(email);
  } catch {
    // keep the closed default
  }
  if (attempts > max) {
    if (attempts === max + 1) await fail("locked_account");
    return { ok: false, reason: "limited" };
  }

  const user = await deps.findUser(email);
  // One bcrypt comparison for every outcome, so timing does not tell whether
  // the email exists.
  const matched = await deps.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !matched || user.disabledAt) {
    await fail(!user ? "unknown_user" : user.disabledAt ? "disabled" : "bad_password", user);
    return { ok: false, reason: "invalid" };
  }

  // The password is right. Whether a second factor is still needed is the
  // caller's decision (`user.mfaEnabled`): lib/auth/config.ts refuses to sign such
  // an account in on the password alone.
  await deps.failures.clear(email).catch(() => undefined);
  return { ok: true, user };
}
