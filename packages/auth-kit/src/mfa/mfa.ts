import { randomBytes } from "node:crypto";

import type { AuditEvent } from "../audit-event";
import type { AuthDbAdapter, MfaPurpose } from "../adapter";
import { hasStrongFactor, type UserFactors } from "./factors";
import { generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from "./recovery";
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
import { openFactorSecret, sealFactorSecret } from "./sealed";
import { matchTotp, newTotpSecret, TOTP_STEP_SECONDS, TOTP_WINDOW } from "./totp";

// The second sign-in step and the factors behind it. A challenge row is the
// ticket that proves the password step passed: an emailed code, an
// authenticator-app code, a recovery code or a passkey marks it verified,
// and the sign-in then consumes it exactly once. Every state change is an
// atomic conditional update, so two parallel requests cannot both win.
// docs/plan/admin-cms-adr.md, section 6.4.

export type { MfaPurpose };

/** `retryAfterSeconds` is set on "limited" when the limiter reports when the window frees up. */
export type IssueResult =
  | { ok: true; challengeId: string }
  | { ok: false; error: "limited" | "locked" | "send_failed"; retryAfterSeconds?: number };
export type VerifyResult = { ok: true } | { ok: false; reason: "invalid" | "locked" | "expired" | "consumed" };
export type FactorMethod = "email" | "totp" | "recovery" | "passkey";

export type TotpSetupResult =
  | { ok: true; recoveryCodes: string[] | null }
  | { ok: false; reason: "invalid" | "not_started" | "limited" };

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface Actor {
  id: string;
  email: string;
}

export function createMfa(deps: {
  adapter: AuthDbAdapter;
  authSecret: string;
  limit: (bucket: string, key: string) => Promise<{ ok: boolean; resetSeconds?: number }>;
  sendEmail: (
    message: { to: string; subject: string; html: string; text: string; category: string },
    context: { actor: { id: string; email: string } }
  ) => Promise<{ ok: boolean }>;
  /**
   * Writes an audit row. Factor changes pass `tx`: write the row inside it and
   * throw on failure, so a change and its row commit or roll back together.
   */
  audit: (event: AuditEvent, tx?: unknown) => Promise<void>;
  /** `purpose` says what the code is for, so the email can name it. */
  renderMfaCode: (input: { name: string | null; code: string; minutes: number; purpose: MfaPurpose }) => RenderedEmail;
  /** Seals authenticator-app secrets (./sealed.ts). Defaults to `authSecret`. */
  factorSecret?: string;
  /**
   * Records `key` once for `ttlSeconds`; false when it was already recorded
   * (a Redis `SET NX`). One authenticator-app code works only once.
   */
  claimOnce: (key: string, ttlSeconds: number) => Promise<boolean>;
  /** Bounds wrong codes while confirming an authenticator app. Without it there is no limit. */
  setupLimit?: (userId: string) => Promise<{ ok: boolean }>;
}) {
  const { adapter, authSecret, limit, sendEmail, audit, renderMfaCode, claimOnce, setupLimit } = deps;
  const factorSecret = deps.factorSecret ?? authSecret;
  const totpReplayTtl = (2 * TOTP_WINDOW + 1) * TOTP_STEP_SECONDS;

  /** Opens a challenge; `code` is the secret that verifies it (emailed, or never revealed for a ticket). */
  async function openChallenge(input: { userId: string; purpose: MfaPurpose }, code: string): Promise<IssueResult> {
    const now = Date.now();

    // A per-user ceiling ("mfa:send:user", however the challenge is asked for).
    // Wrong tries carry over between challenges, so this bounds volume, not guessing.
    const sendLimit = await limit("mfa:send:user", input.userId);
    if (!sendLimit.ok) {
      return sendLimit.resetSeconds && sendLimit.resetSeconds > 0
        ? { ok: false, error: "limited", retryAfterSeconds: sendLimit.resetSeconds }
        : { ok: false, error: "limited" };
    }

    // Older open challenges carry their own counters, so the new one starts from
    // the highest of them and the older ones stop working. Otherwise every resend
    // would leave one more challenge that can be guessed in parallel.
    const open = await adapter.findOpenMfaChallenges(input.userId, input.purpose, new Date(now));
    const attempts = Math.max(0, ...open.map((row) => inheritedAttempts(row, now)));
    // Five wrong codes end this window; a new challenge would not help until it passes.
    if (attempts >= MFA_MAX_ATTEMPTS) return { ok: false, error: "locked" };

    const id = newChallengeId();
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
    return { ok: true, challengeId: id };
  }

  async function issueChallenge(input: { userId: string; email: string; name: string | null; purpose: MfaPurpose }): Promise<IssueResult> {
    const code = generateCode();
    const opened = await openChallenge(input, code);
    if (!opened.ok) return opened;

    const rendered = renderMfaCode({ name: input.name, code, minutes: MFA_TTL_MINUTES, purpose: input.purpose });
    const sent = await sendEmail(
      { to: input.email, subject: rendered.subject, html: rendered.html, text: rendered.text, category: "mfa" },
      { actor: { id: input.userId, email: input.email } }
    );
    if (!sent.ok) {
      await adapter.expireMfaChallengeById(opened.challengeId, new Date());
      return { ok: false, error: "send_failed" };
    }

    await audit({
      action: "auth.mfa.sent",
      actor: { id: input.userId, email: input.email },
      entityType: "User",
      entityId: input.userId,
      meta: { purpose: input.purpose },
    });
    return opened;
  }

  /**
   * Opens a challenge without emailing anything, for a user who will verify
   * it with an authenticator app, a recovery code or a passkey. Its code is
   * random and never revealed, so the emailed-code path cannot verify it.
   */
  async function openTicket(input: { userId: string; purpose: MfaPurpose }): Promise<IssueResult> {
    return openChallenge(input, randomBytes(24).toString("base64url"));
  }

  /**
   * A sign-in ticket that is verified at once, for a factor that proved both
   * steps by itself: a passwordless passkey sign-in with user verification.
   * The sign-in then consumes it like any other verified ticket.
   */
  async function openVerifiedTicket(input: { userId: string; email: string; method: FactorMethod }): Promise<IssueResult> {
    const opened = await openTicket({ userId: input.userId, purpose: "SIGN_IN" });
    if (!opened.ok) return opened;
    await adapter.markMfaChallengeVerified(opened.challengeId, new Date());
    await audit({
      action: "auth.mfa.verified",
      actor: { id: input.userId, email: input.email },
      entityType: "User",
      entityId: input.userId,
      meta: { purpose: "SIGN_IN", method: input.method, passwordless: true },
    });
    return opened;
  }

  /**
   * The shared verification path: the challenge must be open, the attempt is
   * counted first (atomically, while attempts remain), then `check` runs.
   */
  async function verifyFactor(input: {
    challengeId: string;
    userId: string;
    email: string;
    purpose: MfaPurpose;
    method: FactorMethod;
    check: (challenge: { id: string; codeHash: string }) => Promise<boolean>;
  }): Promise<VerifyResult> {
    const now = Date.now();
    const row = await adapter.findMfaChallengeById(input.challengeId, input.userId, input.purpose);
    // Unknown, foreign and wrong-purpose challenges all look the same.
    if (!row) return { ok: false, reason: "invalid" };

    const status = challengeStatus(row, now);
    if (status === "consumed") return { ok: false, reason: "consumed" };
    if (status === "expired") return { ok: false, reason: "expired" };
    if (status === "locked") return { ok: false, reason: "locked" };
    // Already verified: answer ok without touching the attempt counter, so a
    // double click or a retried request never burns one of the five guesses.
    // The verified window (MFA_VERIFIED_WINDOW_SECONDS) bounds how long this
    // stays true; `consumeChallenge` still enforces single use.
    if (status === "verified") return { ok: true };

    const counted = await adapter.incrementMfaAttempts(row.id, new Date(now), MFA_MAX_ATTEMPTS);
    if (counted.count !== 1) return { ok: false, reason: "locked" };

    const actor = { id: input.userId, email: input.email };
    let passed = false;
    try {
      passed = await input.check({ id: row.id, codeHash: row.codeHash });
    } catch {
      passed = false;
    }
    if (!passed) {
      const used = await adapter.findMfaChallengeAttempts(row.id);
      const locked = (used?.attempts ?? 0) >= MFA_MAX_ATTEMPTS;
      await audit({
        action: locked ? "auth.mfa.locked" : "auth.mfa.failed",
        actor,
        entityType: "User",
        entityId: input.userId,
        meta: { purpose: input.purpose, method: input.method, attempts: used?.attempts },
      });
      return { ok: false, reason: locked ? "locked" : "invalid" };
    }

    await adapter.markMfaChallengeVerified(row.id, new Date());
    await audit({
      action: "auth.mfa.verified",
      actor,
      entityType: "User",
      entityId: input.userId,
      meta: { purpose: input.purpose, method: input.method },
    });
    return { ok: true };
  }

  async function verifyChallenge(input: { challengeId: string; userId: string; email: string; purpose: MfaPurpose; code: string }): Promise<VerifyResult> {
    return verifyFactor({ ...input, method: "email", check: async (row) => codeMatches(input.code, row.codeHash, row.id, authSecret) });
  }

  /** True when `code` is the authenticator app's current code, not used before. */
  async function totpMatches(userId: string, code: string, requireConfirmed: boolean): Promise<boolean> {
    const factors = await adapter.findMfaFactors(userId);
    if (!factors?.totpSecretCipher || (requireConfirmed && !factors.totpEnabledAt)) return false;
    const step = matchTotp(openFactorSecret(factors.totpSecretCipher, factorSecret), code, Date.now());
    if (step === null) return false;
    return claimOnce ? claimOnce(`mfa:totp:${userId}:${step}`, totpReplayTtl) : true;
  }

  async function verifyTotp(input: { challengeId: string; userId: string; email: string; purpose: MfaPurpose; code: string }): Promise<VerifyResult> {
    return verifyFactor({ ...input, method: "totp", check: () => totpMatches(input.userId, input.code, true) });
  }

  async function verifyRecoveryCode(input: { challengeId: string; userId: string; email: string; purpose: MfaPurpose; code: string }): Promise<VerifyResult> {
    return verifyFactor({
      ...input,
      method: "recovery",
      check: async () => {
        const code = normalizeRecoveryCode(input.code);
        if (!code) return false;
        const spent = await adapter.consumeRecoveryCode(input.userId, hashRecoveryCode(code, input.userId, authSecret), new Date());
        return spent.count === 1;
      },
    });
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

  /** What the user has set up, in the shape the method policy (./factors) takes. */
  async function factorsOf(userId: string): Promise<UserFactors | null> {
    const row = await adapter.findMfaFactors(userId);
    if (!row) return null;
    return { emailOtp: row.mfaEnabled, totp: row.totpEnabledAt !== null, passkeys: row.passkeys, recoveryCodesLeft: row.recoveryCodesLeft };
  }

  /**
   * Runs one user's factor change in a transaction, serialized per user. `fn`
   * writes its audit row on `tx`, so the change and the row land together.
   */
  function changeFactors<T>(userId: string, fn: (tx: unknown) => Promise<T>): Promise<T> {
    return adapter.withTransaction(async (tx) => {
      await adapter.lockUser(userId, tx);
      return fn(tx);
    });
  }

  /** Whether these factors include an authenticator app or a passkey. */
  const strong = (factors: { totpEnabledAt: Date | null; passkeys: number } | null) =>
    factors !== null && hasStrongFactor({ totp: factors.totpEnabledAt !== null, passkeys: factors.passkeys });

  /** Inside `tx`: new recovery codes replace any old ones; returns them for one-time display. */
  async function writeRecoveryCodes(actor: Actor, tx: unknown): Promise<string[]> {
    const codes = generateRecoveryCodes();
    await adapter.replaceRecoveryCodes(
      actor.id,
      codes.map((code) => hashRecoveryCode(normalizeRecoveryCode(code)!, actor.id, authSecret)),
      tx
    );
    await audit({ action: "auth.mfa.recovery_codes_issued", actor, entityType: "User", entityId: actor.id, meta: { count: codes.length } }, tx);
    return codes;
  }

  /** Inside `tx`: drops the recovery codes when no strong factor is left. True when it did. */
  async function dropOrphanedRecoveryCodes(userId: string, tx: unknown): Promise<boolean> {
    const left = await adapter.findMfaFactors(userId, tx);
    if (!left || strong(left) || left.recoveryCodesLeft === 0) return false;
    await adapter.replaceRecoveryCodes(userId, [], tx);
    return true;
  }

  /** New recovery codes replace any old ones; returns them for one-time display. */
  function issueRecoveryCodes(actor: Actor): Promise<string[]> {
    return changeFactors(actor.id, (tx) => writeRecoveryCodes(actor, tx));
  }

  /**
   * Starts setting up an authenticator app: stores a new sealed secret,
   * unconfirmed, and returns it (base32) for the QR code. A confirmed app
   * must be removed first; starting again replaces an unconfirmed secret.
   */
  async function beginTotpSetup(actor: Actor): Promise<{ ok: true; secret: string } | { ok: false; reason: "already_enabled" }> {
    const secret = newTotpSecret();
    // Conditional on no confirmed app, so a confirm that lands first is never overwritten.
    const { count } = await adapter.beginTotpSecret(actor.id, sealFactorSecret(secret, factorSecret));
    return count === 1 ? { ok: true, secret } : { ok: false, reason: "already_enabled" };
  }

  /**
   * Confirms the app with a current code. The first strong factor also issues
   * recovery codes, returned once; later confirmations return null.
   */
  async function confirmTotpSetup(actor: Actor, code: string): Promise<TotpSetupResult> {
    if (setupLimit && !(await setupLimit(actor.id)).ok) return { ok: false, reason: "limited" };
    const factors = await adapter.findMfaFactors(actor.id);
    const cipher = factors?.totpSecretCipher;
    if (!cipher || factors.totpEnabledAt) return { ok: false, reason: "not_started" };
    if (!(await totpMatches(actor.id, code, false))) return { ok: false, reason: "invalid" };
    return changeFactors(actor.id, async (tx): Promise<TotpSetupResult> => {
      const before = await adapter.findMfaFactors(actor.id, tx);
      // Only the secret the code was checked against; a restarted setup is not confirmed by an old code.
      if ((await adapter.confirmTotpSecret(actor.id, cipher, new Date(), tx)).count !== 1) return { ok: false, reason: "not_started" };
      await audit({ action: "auth.mfa.totp_enabled", actor, entityType: "User", entityId: actor.id }, tx);
      return { ok: true, recoveryCodes: strong(before) ? null : await writeRecoveryCodes(actor, tx) };
    });
  }

  /** Removes the authenticator app. With no strong factor left, recovery codes go too. */
  async function removeTotp(actor: Actor): Promise<void> {
    await changeFactors(actor.id, async (tx) => {
      await adapter.setTotpSecret(actor.id, null, null, tx);
      await dropOrphanedRecoveryCodes(actor.id, tx);
      await audit({ action: "auth.mfa.totp_removed", actor, entityType: "User", entityId: actor.id }, tx);
    });
  }

  /**
   * Removes a user's factors on someone else's behalf (an administrator
   * helping a person who lost a device): the authenticator app, one or every
   * passkey, and/or the recovery codes. With no strong factor left the
   * recovery codes go too. The caller authorizes the actor; this records who
   * did it, against the user whose factors changed. The result says what was
   * actually removed, all false and 0 when nothing was there to remove.
   */
  function removeFactors(
    actor: Actor,
    input: { userId: string; totp?: boolean; passkeyId?: string; allPasskeys?: boolean; recoveryCodes?: boolean }
  ): Promise<{ totp: boolean; passkeys: number; recoveryCodes: boolean }> {
    const { userId } = input;
    return changeFactors(userId, async (tx) => {
      const before = await adapter.findMfaFactors(userId, tx);
      if (!before) return { totp: false, passkeys: 0, recoveryCodes: false };
      const totp = Boolean(input.totp) && before.totpSecretCipher !== null;
      if (totp) await adapter.setTotpSecret(userId, null, null, tx);
      let passkeys = 0;
      if (input.allPasskeys) passkeys = (await adapter.deletePasskeys(userId, tx)).count;
      else if (input.passkeyId) passkeys = (await adapter.deletePasskey(userId, input.passkeyId, tx)).count;
      let recoveryCodes = false;
      if (input.recoveryCodes && before.recoveryCodesLeft > 0) {
        await adapter.replaceRecoveryCodes(userId, [], tx);
        recoveryCodes = true;
      } else {
        recoveryCodes = await dropOrphanedRecoveryCodes(userId, tx);
      }
      if (totp || passkeys > 0 || recoveryCodes) {
        await audit({ action: "auth.mfa.factors_removed", actor, entityType: "User", entityId: userId, meta: { totp, passkeys, recoveryCodes } }, tx);
      }
      return { totp, passkeys, recoveryCodes };
    });
  }

  return {
    changeFactors,
    writeRecoveryCodes,
    dropOrphanedRecoveryCodes,
    removeFactors,
    issueChallenge,
    openTicket,
    openVerifiedTicket,
    verifyChallenge,
    verifyTotp,
    verifyRecoveryCode,
    verifyFactor,
    consumeChallenge,
    challengeOwner,
    factorsOf,
    issueRecoveryCodes,
    beginTotpSetup,
    confirmTotpSetup,
    removeTotp,
  };
}
