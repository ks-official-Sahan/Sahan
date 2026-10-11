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

// Passkeys (WebAuthn). Second-step challenges live in mfa_challenges; a
// passwordless one has no user yet, so it lives in `challengeStore`.
// Passkeys are discoverable, so the browser's account picker names the user.

export type { AuthenticationResponseJSON, RegistrationResponseJSON };

interface Actor {
  id: string;
  email: string;
  name?: string | null;
}

type WebAuthnLib = Pick<typeof simple, "generateRegistrationOptions" | "verifyRegistrationResponse" | "generateAuthenticationOptions" | "verifyAuthenticationResponse">;

export interface PasskeysDeps {
  adapter: AuthDbAdapter;
  mfa: Pick<ReturnType<typeof createMfa>, "verifyFactor" | "changeFactors" | "writeRecoveryCodes" | "dropOrphanedRecoveryCodes">;
  authSecret: string;
  /** As in createMfa: factor changes pass `tx`, and the row is written inside it. */
  audit: (event: AuditEvent, tx?: unknown) => Promise<void>;
  /** Shown by the browser when creating a passkey, for example the site name. */
  rpName: string;
  /** The site's registrable domain, for example "example.com". */
  rpID: string;
  /** The exact origin(s) the ceremony runs on, for example "https://example.com". */
  origin: string | string[];
  /**
   * Single-use storage for passwordless challenges: `put` records a key for
   * `ttlSeconds`; `take` deletes it and says whether it was there (Redis DEL
   * count). Required only for passwordless sign-in.
   */
  challengeStore?: {
    put(key: string, ttlSeconds: number): Promise<void>;
    take(key: string): Promise<boolean>;
  };
  /** For tests only: replaces @simplewebauthn/server's functions. */
  lib?: WebAuthnLib;
}

export type PasswordlessResult = { ok: true; userId: string; passkeyId: string } | { ok: false; reason: "invalid" | "expired" | "unavailable" };

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
      // Discoverable, so the passkey can also sign in on its own (the browser's account picker).
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    });
    return { challengeId: await storeChallenge(actor.id, "PASSKEY_REGISTER", options.challenge), options };
  }

  /**
   * Verifies the browser's response and saves the passkey. The first strong
   * factor (no authenticator app or passkey before) also issues recovery
   * codes, returned once.
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

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    return mfa.changeFactors(actor.id, async (tx) => {
      const before = await adapter.findMfaFactors(actor.id, tx);
      await adapter.createPasskey(
        {
          id: credential.id,
          userId: actor.id,
          publicKey: Buffer.from(credential.publicKey).toString("base64url"),
          counter: credential.counter,
          transports: credential.transports ?? input.response.response.transports ?? [],
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          name: input.name.trim().slice(0, 60) || "Passkey",
        },
        tx
      );
      await audit({ action: "auth.mfa.passkey_added", actor, entityType: "User", entityId: actor.id, meta: { deviceType: credentialDeviceType, backedUp: credentialBackedUp } }, tx);
      const first = before !== null && !hasStrongFactor({ totp: before.totpEnabledAt !== null, passkeys: before.passkeys });
      return { ok: true as const, recoveryCodes: first ? await mfa.writeRecoveryCodes(actor, tx) : null };
    });
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

  const passwordlessKey = (challenge: string) => `webauthn:passwordless:${challengeHash(challenge, "passwordless", authSecret)}`;

  /**
   * Options for a passwordless navigator.credentials.get(): no credential
   * list (the browser offers every discoverable passkey for this site) and
   * user verification required, so the passkey proves both steps.
   */
  async function passwordlessOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
    if (!deps.challengeStore) throw new Error("createPasskeys: passwordless sign-in needs challengeStore.");
    const options = await lib.generateAuthenticationOptions({ rpID, userVerification: "required" });
    await deps.challengeStore.put(passwordlessKey(options.challenge), MFA_TTL_MINUTES * 60);
    return options;
  }

  /**
   * Verifies a passwordless assertion: the challenge is taken once, the
   * credential and its user handle must name the same user, and the
   * authenticator must have verified the user. Returns who signed in; the
   * caller opens a verified ticket (mfa.openVerifiedTicket) and signs in.
   */
  async function verifyPasswordless(response: AuthenticationResponseJSON): Promise<PasswordlessResult> {
    if (!deps.challengeStore) return { ok: false, reason: "unavailable" };
    const store = deps.challengeStore;
    const passkey = typeof response?.id === "string" ? await adapter.findPasskey(response.id) : null;
    if (!passkey) return { ok: false, reason: "invalid" };
    // The user handle is the user id the passkey was created with (registrationOptions).
    const handle = response.response?.userHandle;
    if (handle && Buffer.from(handle, "base64url").toString("utf8") !== passkey.userId) return { ok: false, reason: "invalid" };

    let taken = false;
    let verification: Awaited<ReturnType<WebAuthnLib["verifyAuthenticationResponse"]>>;
    try {
      verification = await lib.verifyAuthenticationResponse({
        response,
        expectedChallenge: async (challenge) => (taken = await store.take(passwordlessKey(challenge))),
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: { id: passkey.id, publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64url")), counter: passkey.counter, transports: passkey.transports as never },
        requireUserVerification: true,
      });
    } catch {
      return { ok: false, reason: taken ? "invalid" : "expired" };
    }
    if (!verification.verified || !verification.authenticationInfo.userVerified) return { ok: false, reason: "invalid" };
    await adapter.updatePasskeyUse(passkey.id, verification.authenticationInfo.newCounter, new Date());
    return { ok: true, userId: passkey.userId, passkeyId: passkey.id };
  }

  /** Removes one of the user's passkeys. With no strong factor left, recovery codes go too. */
  function removePasskey(actor: Actor, id: string): Promise<boolean> {
    return mfa.changeFactors(actor.id, async (tx) => {
      if ((await adapter.deletePasskey(actor.id, id, tx)).count !== 1) return false;
      await mfa.dropOrphanedRecoveryCodes(actor.id, tx);
      await audit({ action: "auth.mfa.passkey_removed", actor, entityType: "User", entityId: actor.id }, tx);
      return true;
    });
  }

  return { registrationOptions, verifyRegistration, authenticationOptions, verifyAuthentication, passwordlessOptions, verifyPasswordless, removePasskey };
}
