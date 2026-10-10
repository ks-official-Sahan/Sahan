// Which second-step methods a user may use, from what they have set up. Pure
// policy, shared by the sign-in step, the account page and the admin gate:
// - an authenticator app (TOTP) or a passkey is a strong factor;
// - the emailed code is offered whenever it is switched on, and the user picks
//   the method on the sign-in step;
// - recovery codes stand in for a lost strong factor;
// - roles listed in `strongMfaRoles` must set up a strong factor before using
//   the admin (they may still choose the emailed code at sign-in).

export interface UserFactors {
  /** Emailed codes are switched on (users.mfaEnabled). */
  emailOtp: boolean;
  /** An authenticator app is set up and confirmed. */
  totp: boolean;
  passkeys: number;
  recoveryCodesLeft: number;
}

export interface MfaMethods {
  email: boolean;
  totp: boolean;
  passkey: boolean;
  recovery: boolean;
}

export function hasStrongFactor(factors: Pick<UserFactors, "totp" | "passkeys">): boolean {
  return factors.totp || factors.passkeys > 0;
}

export function requiresStrongMfa(role: string, strongMfaRoles: readonly string[]): boolean {
  return strongMfaRoles.includes(role);
}

/** True when signing in needs a second step at all. */
export function needsSecondStep(factors: UserFactors): boolean {
  return factors.emailOtp || hasStrongFactor(factors);
}

/**
 * The methods the second sign-in step offers this user. `role` and
 * `strongMfaRoles` are kept for callers that pass them; the offer no longer
 * depends on the role.
 */
export function mfaMethodsFor(_role: string, factors: UserFactors, _strongMfaRoles: readonly string[] = []): MfaMethods {
  return {
    email: factors.emailOtp,
    totp: factors.totp,
    passkey: factors.passkeys > 0,
    recovery: hasStrongFactor(factors) && factors.recoveryCodesLeft > 0,
  };
}

/** True when this user must set up an authenticator app or passkey before using the admin. */
export function mustSetUpStrongMfa(role: string, factors: Pick<UserFactors, "totp" | "passkeys">, strongMfaRoles: readonly string[]): boolean {
  return requiresStrongMfa(role, strongMfaRoles) && !hasStrongFactor(factors);
}
