// Which second-step methods a user may use, from their role and what they
// have set up. Pure policy, shared by the sign-in step, the account page and
// the admin gate:
// - an authenticator app (TOTP) or a passkey is a strong factor;
// - recovery codes stand in for a lost strong factor;
// - the emailed code is a fallback: roles listed in `strongMfaRoles` lose it
//   once they have a strong factor, and must set one up before using the admin.

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

/** The methods the second sign-in step offers this user. */
export function mfaMethodsFor(role: string, factors: UserFactors, strongMfaRoles: readonly string[]): MfaMethods {
  const strong = hasStrongFactor(factors);
  return {
    // A required role keeps the emailed code only until it has a strong factor.
    email: factors.emailOtp && !(strong && requiresStrongMfa(role, strongMfaRoles)),
    totp: factors.totp,
    passkey: factors.passkeys > 0,
    recovery: strong && factors.recoveryCodesLeft > 0,
  };
}

/** True when this user must set up an authenticator app or passkey before using the admin. */
export function mustSetUpStrongMfa(role: string, factors: Pick<UserFactors, "totp" | "passkeys">, strongMfaRoles: readonly string[]): boolean {
  return requiresStrongMfa(role, strongMfaRoles) && !hasStrongFactor(factors);
}
