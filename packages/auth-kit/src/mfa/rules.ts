import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

// The rules of the emailed one-time code, without the database: how a code is
// made, hashed and compared, and what state a challenge is in. The database side
// (lib/auth/mfa.ts) applies them with atomic updates. No server-only import, so
// tests and the CLI can load it. docs/plan/admin-cms-adr.md, section 6.4.

export const MFA_CODE_LENGTH = 6;
export const MFA_TTL_MINUTES = 5;
export const MFA_MAX_ATTEMPTS = 5;
/** A verified challenge must be used to sign in within this time. */
export const MFA_VERIFIED_WINDOW_SECONDS = 60;

export const newChallengeId = () => randomUUID();

export function generateCode(): string {
  return String(randomInt(0, 10 ** MFA_CODE_LENGTH)).padStart(MFA_CODE_LENGTH, "0");
}

/** Only digits count; spaces and dashes typed by a person are dropped. */
export function normalizeCode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${MFA_CODE_LENGTH}}$`).test(digits) ? digits : null;
}

/** Keyed hash bound to the challenge id, so a hash cannot be replayed on another challenge. */
export function hashCode(code: string, challengeId: string, secret: string): string {
  return createHmac("sha256", secret).update(`mfa:v1:${challengeId}:${code}`).digest("hex");
}

export function codeMatches(input: string, expectedHash: string, challengeId: string, secret: string): boolean {
  const code = normalizeCode(input);
  if (!code) return false;
  const given = Buffer.from(hashCode(code, challengeId, secret));
  const expected = Buffer.from(expectedHash);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface ChallengeRow {
  attempts: number;
  expiresAt: Date;
  verifiedAt: Date | null;
  consumedAt: Date | null;
}

export type ChallengeStatus = "consumed" | "expired" | "locked" | "verified" | "open";

export function challengeStatus(row: ChallengeRow, now: number): ChallengeStatus {
  if (row.consumedAt) return "consumed";
  if (row.expiresAt.getTime() <= now) return "expired";
  if (row.verifiedAt) return "verified";
  if (row.attempts >= MFA_MAX_ATTEMPTS) return "locked";
  return "open";
}

/** A verified challenge is only good for a short time after the right code. */
export function verifiedWithinWindow(row: Pick<ChallengeRow, "verifiedAt" | "consumedAt">, now: number): boolean {
  if (!row.verifiedAt || row.consumedAt) return false;
  return now - row.verifiedAt.getTime() <= MFA_VERIFIED_WINDOW_SECONDS * 1000;
}

/**
 * A resend starts with the attempts of the latest unexpired challenge of the same
 * user and purpose, so asking for a new code never gives five more guesses.
 */
export function inheritedAttempts(latest: { attempts: number; expiresAt: Date } | null, now: number): number {
  if (!latest || latest.expiresAt.getTime() <= now) return 0;
  return Math.min(latest.attempts, MFA_MAX_ATTEMPTS);
}
