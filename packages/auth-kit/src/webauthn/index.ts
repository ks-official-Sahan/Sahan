import { createHmac, timingSafeEqual } from "node:crypto";

import * as simple from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

import type { AuditEvent } from "../audit-event";
import type { AuthDbAdapter, MfaPurpose } from "../adapter";
import { hasStrongFactor } from "../mfa/factors";
import type { createMfa, VerifyResult } from "../mfa/mfa";
import { challengeStatus, MFA_MAX_ATTEMPTS, MFA_TTL_MINUTES, newChallengeId } from "../mfa/rules";

// Passkeys (WebAuthn) as a second factor: registering one from the account
// page, and using one to verify the sign-in ticket (../mfa/mfa.ts). The
// WebAuthn work is @simplewebauthn/server's, an optional peer dependency
// that only projects importing this subpath install. Each ceremony's
// challenge lives in mfa_challenges (PASSKEY_REGISTER / PASSKEY_SIGN_IN) as
// a keyed hash, single use, with the same attempt cap as a code.

export type { AuthenticationResponseJSON, RegistrationResponseJSON };

interface Actor {
  id: string;
  email: string;
  name?: string | null;
}

type WebAuthnLib = Pick<typeof simple, "generateRegistrationOptions" | "verifyRegistrationResponse" | "generateAuthenticationOptions" | "verifyAuthenticationResponse">;

export interface PasskeysDeps {
  adapter: AuthDbAdapter;
  mfa: Pick<ReturnType<typeof createMfa>, "verifyFactor" | "issueRecoveryCodes">;
  authSecret: string;
  audit: (event: AuditEvent) => Promise<void>;
  /** Shown by the browser when creating a passkey, for example the site name. */
  rpName: string;
  /** The site's registrable domain, for example "example.com". */
  rpID: string;
  /** The exact origin(s) the ceremony runs on, for example "https://example.com". */
  origin: string | string[];
  /** For tests only: replaces @simplewebauthn/server's functions. */
  lib?: WebAuthnLib;
}

function challengeHash(challenge: string, id: string, secret: string): string {
  return createHmac("sha256", secret).update(`webauthn:v1:${id}:${challenge}`).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createPasskeys(deps: PasskeysDeps) {
  const { adapter, mfa, authSecret, audit, rpName, rpID, origin } = deps;
  const lib: WebAuthnLib = deps.lib ?? simple;

  /** Stores a ceremony challenge; older open ones of the same purpose stop working. */
  async function storeChallenge(userId: string, purpose: MfaPurpose, challenge: string): Promise<string> {
    const id = newChallengeId();
    const now = new Date();
    await adapter.withTransaction(async (tx) => {
      await adapter.expireOpenMfaChallenges(userId, purpose, now, tx);
      await adapter.createMfaChallenge(
        { id, userId, purpose, codeHash: challengeHash(challenge, id, authSecret), attempts: 0, expiresAt: new Date(now.getTime() + MFA_TTL_MINUTES * 60_000) },
        tx
      );
    });
    return id;
  }

  /**
   * Takes a stored ceremony challenge for one verification: it must be open,
   * the attempt is counted first, and on success it is consumed. Returns the
   * checker the WebAuthn library calls with the challenge from the response.
   */
  async function takeChallenge(userId: string, purpose: MfaPurpose, challengeId: string): Promise<((challenge: string) => boolean) | null> {
    const row = await adapter.findMfaChallengeById(challengeId, userId, purpose);
    if (!row || challengeStatus(row, Date.now()) !== "open") return null;
    if ((await adapter.incrementMfaAttempts(row.id, new Date(), MFA_MAX_ATTEMPTS)).count !== 1) return null;
    return (challenge) => sameHash(challengeHash(challenge, row.id, authSecret), row.codeHash);
  }

  async function finishChallenge(challengeId: string, userId: string, purpose: MfaPurpose): Promise<boolean> {
    const now = new Date();
    await adapter.markMfaChallengeVerified(challengeId, now);
    return (await adapter.consumeMfaChallenge({ id: challengeId, userId, purpose, now, verifiedWindowSeconds: 60 })).count === 1;
  }

  /** Options for navigator.credentials.create(), plus the challenge id to send back. */
  async function registrationOptions(actor: Actor): Promise<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }> {
    const existing = await adapter.listPasskeys(actor.id);
    const options = await lib.generateRegistrationOptions({
      rpName,
      rpID,
      userName: actor.email,
      userDisplayName: actor.name ?? actor.email,
      userID: new TextEncoder().encode(actor.id),
      attestationType: "none",
      excludeCredentials: existing.map((passkey) => ({ id: passkey.id, transports: passkey.transports as never })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });
    return { challengeId: await storeChallenge(actor.id, "PASSKEY_REGISTER", options.challenge), options };
  }

  /**
   * Verifies the browser's response and saves the passkey. The first strong
   * factor also issues recovery codes, returned once.
   */
  async function verifyRegistration(
    actor: Actor,
    input: { challengeId: string; response: RegistrationResponseJSON; name: string }
  ): Promise<{ ok: true; recoveryCodes: string[] | null } | { ok: false; reason: "invalid" | "expired" }> {
    const expectedChallenge = await takeChallenge(actor.id, "PASSKEY_REGISTER", input.challengeId);
    if (!expectedChallenge) return { ok: false, reason: "expired" };
    let verification: Awaited<ReturnType<WebAuthnLib["verifyRegistrationResponse"]>>;
    try {
      verification = await lib.verifyRegistrationResponse({ response: input.response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false });
    } catch {
      return { ok: false, reason: "invalid" };
    }
    if (!verification.verified || !verification.registrationInfo) return { ok: false, reason: "invalid" };
    if (!(await finishChallenge(input.challengeId, actor.id, "PASSKEY_REGISTER"))) return { ok: false, reason: "expired" };

    const before = await adapter.findMfaFactors(actor.id);
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    await adapter.createPasskey({
      id: credential.id,
      userId: actor.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? input.response.response.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: input.name.trim().slice(0, 60) || "Passkey",
    });
    await audit({ action: "auth.mfa.passkey_added", actor, entityType: "User", entityId: actor.id, meta: { deviceType: credentialDeviceType, backedUp: credentialBackedUp } });
    return { ok: true, recoveryCodes: before && before.recoveryCodesLeft === 0 ? await mfa.issueRecoveryCodes(actor) : null };
  }

  /** Options for navigator.credentials.get() during the sign-in step, limited to the user's passkeys. */
  async function authenticationOptions(userId: string): Promise<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON } | null> {
    const passkeys = await adapter.listPasskeys(userId);
    if (passkeys.length === 0) return null;
    const options = await lib.generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      allowCredentials: passkeys.map((passkey) => ({ id: passkey.id, transports: passkey.transports as never })),
    });
    return { challengeId: await storeChallenge(userId, "PASSKEY_SIGN_IN", options.challenge), options };
  }

  /**
   * Verifies a passkey assertion and, when it passes, marks the sign-in
   * ticket verified (counted like any other second-step attempt).
   */
  async function verifyAuthentication(input: {
    ticketId: string;
    challengeId: string;
    userId: string;
    email: string;
    response: AuthenticationResponseJSON;
  }): Promise<VerifyResult> {
    return mfa.verifyFactor({
      challengeId: input.ticketId,
      userId: input.userId,
      email: input.email,
      purpose: "SIGN_IN",
      method: "passkey",
      check: async () => {
        const expectedChallenge = await takeChallenge(input.userId, "PASSKEY_SIGN_IN", input.challengeId);
        if (!expectedChallenge) return false;
        const passkey = await adapter.findPasskey(input.response.id);
        if (!passkey || passkey.userId !== input.userId) return false;
        const verification = await lib.verifyAuthenticationResponse({
          response: input.response,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          credential: { id: passkey.id, publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64url")), counter: passkey.counter, transports: passkey.transports as never },
          requireUserVerification: false,
        });
        if (!verification.verified) return false;
        if (!(await finishChallenge(input.challengeId, input.userId, "PASSKEY_SIGN_IN"))) return false;
        await adapter.updatePasskeyUse(passkey.id, verification.authenticationInfo.newCounter, new Date());
        return true;
      },
    });
  }

  /** Removes one of the user's passkeys. With no strong factor left, recovery codes go too. */
  async function removePasskey(actor: Actor, id: string): Promise<boolean> {
    const removed = await adapter.deletePasskey(actor.id, id);
    if (removed.count !== 1) return false;
    const left = await adapter.findMfaFactors(actor.id);
    if (left && !hasStrongFactor({ totp: left.totpEnabledAt !== null, passkeys: left.passkeys })) await adapter.replaceRecoveryCodes(actor.id, []);
    await audit({ action: "auth.mfa.passkey_removed", actor, entityType: "User", entityId: actor.id });
    return true;
  }

  return { registrationOptions, verifyRegistration, authenticationOptions, verifyAuthentication, removePasskey };
}
