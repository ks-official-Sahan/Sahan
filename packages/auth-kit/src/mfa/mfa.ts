import type { AuditEvent } from "../audit-event";
import type { AuthDbAdapter, MfaPurpose } from "../adapter";
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
} from "./rules";

// Emailed one-time codes for sign-in, enabling and disabling MFA. Every state
// change is an atomic conditional update, so two parallel requests cannot both
// win. docs/plan/admin-cms-adr.md, section 6.4.

export type { MfaPurpose };

export type IssueResult = { ok: true; challengeId: string } | { ok: false; error: "limited" | "locked" | "send_failed" };
export type VerifyResult = { ok: true } | { ok: false; reason: "invalid" | "locked" | "expired" | "consumed" };

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function createMfa(deps: {
  adapter: AuthDbAdapter;
  authSecret: string;
  limit: (bucket: string, key: string) => Promise<{ ok: boolean }>;
  sendEmail: (
    message: { to: string; subject: string; html: string; text: string; category: string },
    context: { actor: { id: string; email: string } }
  ) => Promise<{ ok: boolean }>;
  audit: (event: AuditEvent) => Promise<void>;
  renderMfaCode: (input: { name: string | null; code: string; minutes: number }) => RenderedEmail;
}) {
  const { adapter, authSecret, limit, sendEmail, audit, renderMfaCode } = deps;

  async function issueChallenge(input: { userId: string; email: string; name: string | null; purpose: MfaPurpose }): Promise<IssueResult> {
    const now = Date.now();

    // Three codes per user per ten minutes, however they are asked for.
    if (!(await limit("mfa:send:user", input.userId)).ok) return { ok: false, error: "limited" };

    // Older open codes carry their own counters, so the new code starts from the
    // highest of them and the older ones stop working. Otherwise every resend would
    // leave one more code that can be guessed in parallel.
    const open = await adapter.findOpenMfaChallenges(input.userId, input.purpose, new Date(now));
    const attempts = Math.max(0, ...open.map((row) => inheritedAttempts(row, now)));
    // Five wrong codes end this window; a new code would not help until it passes.
    if (attempts >= MFA_MAX_ATTEMPTS) return { ok: false, error: "locked" };

    const id = newChallengeId();
    const code = generateCode();
    await adapter.withTransaction(async (tx) => {
      await adapter.expireOpenMfaChallenges(input.userId, input.purpose, new Date(now), tx);
      await adapter.createMfaChallenge(
        {
          id,
          userId: input.userId,
          purpose: input.purpose,
          codeHash: hashCode(code, id, authSecret),
          attempts,
          expiresAt: new Date(now + MFA_TTL_MINUTES * 60_000),
        },
        tx
      );
    });

    const rendered = renderMfaCode({ name: input.name, code, minutes: MFA_TTL_MINUTES });
    const sent = await sendEmail(
      { to: input.email, subject: rendered.subject, html: rendered.html, text: rendered.text, category: "mfa" },
      { actor: { id: input.userId, email: input.email } }
    );
    if (!sent.ok) {
      await adapter.expireMfaChallengeById(id, new Date());
      return { ok: false, error: "send_failed" };
    }

    await audit({
      action: "auth.mfa.sent",
      actor: { id: input.userId, email: input.email },
      entityType: "User",
      entityId: input.userId,
      meta: { purpose: input.purpose },
    });
    return { ok: true, challengeId: id };
  }

  async function verifyChallenge(input: { challengeId: string; userId: string; email: string; purpose: MfaPurpose; code: string }): Promise<VerifyResult> {
    const now = Date.now();
    const row = await adapter.findMfaChallengeById(input.challengeId, input.userId, input.purpose);
    // Unknown, foreign and wrong-purpose challenges all look the same.
    if (!row) return { ok: false, reason: "invalid" };

    const status = challengeStatus(row, now);
    if (status === "consumed") return { ok: false, reason: "consumed" };
    if (status === "expired") return { ok: false, reason: "expired" };
    if (status === "locked") return { ok: false, reason: "locked" };

    // Count the attempt first, atomically and only while attempts remain, then
    // compare. Parallel guesses therefore cannot exceed the limit.
    const counted = await adapter.incrementMfaAttempts(row.id, new Date(now), MFA_MAX_ATTEMPTS);
    if (counted.count !== 1) return { ok: false, reason: "locked" };

    const actor = { id: input.userId, email: input.email };
    if (!codeMatches(input.code, row.codeHash, row.id, authSecret)) {
      const used = await adapter.findMfaChallengeAttempts(row.id);
      const locked = (used?.attempts ?? 0) >= MFA_MAX_ATTEMPTS;
      await audit({
        action: locked ? "auth.mfa.locked" : "auth.mfa.failed",
        actor,
        entityType: "User",
        entityId: input.userId,
        meta: { purpose: input.purpose, attempts: used?.attempts },
      });
      return { ok: false, reason: locked ? "locked" : "invalid" };
    }

    await adapter.markMfaChallengeVerified(row.id, new Date());
    await audit({
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
  async function consumeChallenge(input: { challengeId: string; userId: string; purpose: MfaPurpose }): Promise<boolean> {
    const result = await adapter.consumeMfaChallenge({
      id: input.challengeId,
      userId: input.userId,
      purpose: input.purpose,
      now: new Date(),
      verifiedWindowSeconds: MFA_VERIFIED_WINDOW_SECONDS,
    });
    return result.count === 1;
  }

  /** The owner of a challenge, for the sign-in code step, which has only the challenge id. */
  async function challengeOwner(challengeId: string, purpose: MfaPurpose) {
    return adapter.findMfaChallengeOwner(challengeId, purpose);
  }

  return { issueChallenge, verifyChallenge, consumeChallenge, challengeOwner };
}
