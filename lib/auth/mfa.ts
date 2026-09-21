import "server-only";

import { auditSafe } from "@/lib/admin/audit";
import { limit } from "@/lib/cache/ratelimit";
import { db } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email";
import { mfaCode } from "@/lib/email/templates";
import { getEnv } from "@/lib/env";

import {
  challengeStatus,
  codeMatches,
  generateCode,
  hashCode,
  inheritedAttempts,
  MFA_MAX_ATTEMPTS,
  MFA_TTL_MINUTES,
  MFA_VERIFIED_WINDOW_SECONDS,
  newChallengeId,
} from "./mfa-rules";

// Emailed one-time codes for sign-in, enabling and disabling MFA. Every state
// change is an atomic conditional update, so two parallel requests cannot both
// win. docs/plan/admin-cms-adr.md, section 6.4.

export type MfaPurpose = "SIGN_IN" | "ENABLE" | "DISABLE";

export type IssueResult =
  | { ok: true; challengeId: string }
  | { ok: false; error: "limited" | "locked" | "send_failed" };

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "locked" | "expired" | "consumed" };

function secret(): string {
  const value = getEnv().AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

export async function issueChallenge(input: {
  userId: string;
  email: string;
  name: string | null;
  purpose: MfaPurpose;
}): Promise<IssueResult> {
  const now = Date.now();

  // Three codes per user per ten minutes, however they are asked for.
  if (!(await limit("mfa:send:user", input.userId)).ok) return { ok: false, error: "limited" };

  // Older open codes carry their own counters, so the new code starts from the
  // highest of them and the older ones stop working. Otherwise every resend would
  // leave one more code that can be guessed in parallel.
  const open = await db.mfaChallenge.findMany({
    where: { userId: input.userId, purpose: input.purpose, consumedAt: null, expiresAt: { gt: new Date(now) } },
    select: { attempts: true, expiresAt: true },
  });
  const attempts = Math.max(0, ...open.map((row) => inheritedAttempts(row, now)));
  // Five wrong codes end this window; a new code would not help until it passes.
  if (attempts >= MFA_MAX_ATTEMPTS) return { ok: false, error: "locked" };

  const id = newChallengeId();
  const code = generateCode();
  await db.$transaction([
    db.mfaChallenge.updateMany({
      where: { userId: input.userId, purpose: input.purpose, consumedAt: null, expiresAt: { gt: new Date(now) } },
      data: { expiresAt: new Date(now) },
    }),
    db.mfaChallenge.create({
      data: {
        id,
        userId: input.userId,
        purpose: input.purpose,
        codeHash: hashCode(code, id, secret()),
        attempts,
        expiresAt: new Date(now + MFA_TTL_MINUTES * 60_000),
      },
    }),
  ]);

  const rendered = mfaCode({ name: input.name, code, minutes: MFA_TTL_MINUTES });
  const sent = await sendEmail(
    { to: input.email, subject: rendered.subject, html: rendered.html, text: rendered.text, category: "mfa" },
    { actor: { id: input.userId, email: input.email } }
  );
  if (!sent.ok) {
    await db.mfaChallenge.updateMany({ where: { id }, data: { expiresAt: new Date() } });
    return { ok: false, error: "send_failed" };
  }

  await auditSafe({
    action: "auth.mfa.sent",
    actor: { id: input.userId, email: input.email },
    entityType: "User",
    entityId: input.userId,
    meta: { purpose: input.purpose },
  });
  return { ok: true, challengeId: id };
}

export async function verifyChallenge(input: {
  challengeId: string;
  userId: string;
  email: string;
  purpose: MfaPurpose;
  code: string;
}): Promise<VerifyResult> {
  const now = Date.now();
  const row = await db.mfaChallenge.findFirst({
    where: { id: input.challengeId, userId: input.userId, purpose: input.purpose },
  });
  // Unknown, foreign and wrong-purpose challenges all look the same.
  if (!row) return { ok: false, reason: "invalid" };

  const status = challengeStatus(row, now);
  if (status === "consumed") return { ok: false, reason: "consumed" };
  if (status === "expired") return { ok: false, reason: "expired" };
  if (status === "locked") return { ok: false, reason: "locked" };

  // Count the attempt first, atomically and only while attempts remain, then
  // compare. Parallel guesses therefore cannot exceed the limit.
  const counted = await db.mfaChallenge.updateMany({
    where: {
      id: row.id,
      consumedAt: null,
      expiresAt: { gt: new Date(now) },
      attempts: { lt: MFA_MAX_ATTEMPTS },
    },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count !== 1) return { ok: false, reason: "locked" };

  const actor = { id: input.userId, email: input.email };
  if (!codeMatches(input.code, row.codeHash, row.id, secret())) {
    const used = await db.mfaChallenge.findUnique({ where: { id: row.id }, select: { attempts: true } });
    const locked = (used?.attempts ?? 0) >= MFA_MAX_ATTEMPTS;
    await auditSafe({
      action: locked ? "auth.mfa.locked" : "auth.mfa.failed",
      actor,
      entityType: "User",
      entityId: input.userId,
      meta: { purpose: input.purpose, attempts: used?.attempts },
    });
    return { ok: false, reason: locked ? "locked" : "invalid" };
  }

  await db.mfaChallenge.updateMany({ where: { id: row.id, verifiedAt: null }, data: { verifiedAt: new Date() } });
  await auditSafe({
    action: "auth.mfa.verified",
    actor,
    entityType: "User",
    entityId: input.userId,
    meta: { purpose: input.purpose },
  });
  return { ok: true };
}

/**
 * Uses a verified challenge exactly once. It succeeds only when one row changes:
 * the right user and purpose, verified in the last 60 seconds, not yet consumed.
 */
export async function consumeChallenge(input: {
  challengeId: string;
  userId: string;
  purpose: MfaPurpose;
}): Promise<boolean> {
  const now = Date.now();
  const result = await db.mfaChallenge.updateMany({
    where: {
      id: input.challengeId,
      userId: input.userId,
      purpose: input.purpose,
      consumedAt: null,
      verifiedAt: { gte: new Date(now - MFA_VERIFIED_WINDOW_SECONDS * 1000) },
      expiresAt: { gt: new Date(now) },
    },
    data: { consumedAt: new Date(now) },
  });
  return result.count === 1;
}

/** The owner of a challenge, for the sign-in code step, which has only the challenge id. */
export async function challengeOwner(challengeId: string, purpose: MfaPurpose) {
  return db.mfaChallenge.findFirst({
    where: { id: challengeId, purpose, consumedAt: null },
    select: { userId: true, user: { select: { id: true, email: true, name: true, disabledAt: true } } },
  });
}
