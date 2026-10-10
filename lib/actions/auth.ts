"use server";

import { redirect } from "next/navigation";

import { auditSafe } from "@/lib/admin/audit";
import { retryMessage } from "@/lib/admin/rate-limited";
import { hasValidUnlock } from "@/lib/admin/unlock-request";
import { getOptionalUser } from "@/lib/auth/dal";
import { attemptSignIn, signOutAndRedirect } from "@/lib/auth/engine";
import {
  challengeOwner,
  issueChallenge,
  openTicket,
  signInMethods,
  verifyChallenge,
  verifyRecoveryCode,
  verifyTotp,
  type IssueResult,
  type MfaMethods,
  type VerifyResult,
} from "@/lib/auth/mfa";
import { MFA_TTL_MINUTES, normalizeCode } from "@/lib/auth/mfa-rules";
import { passkeys } from "@/lib/auth/passkeys";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";
import { revokeSession } from "@/lib/auth/session-store";
import { repos } from "@/lib/data";
import type { AuthenticationResponseJSON } from "@sahan-sac/auth-kit/webauthn";

// Sign-in and sign-out as Server Functions. They stay POST requests to the
// admin route, so the proxy origin check and the Next origin check both apply
// (docs/plan/admin-cms-adr.md, sections 4.5 and 6.1).
//
// An account with a second factor signs in in two steps. The password step
// starts no session: it opens the second step, which is an emailed code, or,
// for an account with an authenticator app or passkey, a ticket verified by
// one of those (or a recovery code). The second step starts the session.

export interface SignInState {
  error: string | null;
  /** Present while the form is on its second step. */
  challengeId?: string;
  /** "email": a code was emailed. "factor": authenticator app, passkey or recovery code. */
  step?: "email" | "factor";
  methods?: MfaMethods;
  notice?: string | null;
  /** Orders results from the different step actions; the form shows the newest. */
  at?: number;
}

const GENERIC = "The email or password is not correct.";
const MESSAGES: Record<string, string> = {
  limited: "Too many attempts. Wait a while and try again.",
};
const ISSUE_ERRORS = {
  limited: "Too many codes were asked for.",
  locked: "Too many wrong codes. Wait a few minutes and try again.",
  send_failed: "The code could not be emailed. Try again in a moment.",
} as const;
const CODE_ERRORS = {
  invalid: "That code is not correct.",
  locked: "Too many wrong codes. Wait a few minutes and sign in again.",
  expired: "That code expired. Sign in again.",
  consumed: "That code was already used. Sign in again.",
} as const;
const EXPIRED = "That code expired. Sign in again.";
const NO_EMAIL = "Use your authenticator app, a passkey or a recovery code.";

const stamp = (state: SignInState): SignInState => ({ ...state, at: Date.now() });

function messageFor(code: string | null | undefined): string {
  return (code && MESSAGES[code]) || GENERIC;
}

const codeStep = (challengeId: string, email: string, notice?: string): SignInState =>
  stamp({ error: null, challengeId, step: "email", notice: notice ?? `We emailed a 6 digit code to ${email}. It works for ${MFA_TTL_MINUTES} minutes.` });

const factorStep = (challengeId: string, methods: MfaMethods, error: string | null = null): SignInState =>
  stamp({ error, challengeId, step: "factor", methods, notice: null });

const issueError = (issued: Extract<IssueResult, { ok: false }>): SignInState =>
  stamp({ error: issued.error === "limited" ? `${ISSUE_ERRORS.limited} ${retryMessage(issued.retryAfterSeconds ?? 0)}` : ISSUE_ERRORS[issued.error] });

/** The open sign-in ticket's owner and what they may use, or null when it is gone. */
async function ticket(challengeId: unknown) {
  if (typeof challengeId !== "string" || !challengeId) return null;
  const owner = await challengeOwner(challengeId, "SIGN_IN");
  if (!owner || owner.user.disabledAt) return null;
  const methods = await signInMethods(owner.userId);
  return methods ? { challengeId, owner, methods } : null;
}

/** Starts the session from a verified ticket; returns an error state or redirects. */
async function finish(challengeId: string, callbackUrl: unknown): Promise<SignInState> {
  const refused = await attemptSignIn({ challengeId });
  if (refused) return stamp({ error: refused.code === "limited" ? MESSAGES.limited : EXPIRED });
  redirect(safeCallbackUrl(callbackUrl));
}

export async function startSignIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const target = safeCallbackUrl(formData.get("callbackUrl"));

  // Same answer as a wrong password, so this cannot be used to probe the unlock.
  if (!(await hasValidUnlock())) return stamp({ error: GENERIC });

  const refused = await attemptSignIn({
    email: typeof email === "string" ? email : "",
    password: typeof password === "string" ? password : "",
  });

  if (refused?.code === "mfa_required") {
    // The password was right (Auth.js only says so after the limiter and the hash
    // check), so it is safe to look the account up and open its second step.
    const user = await repos.users.findRefByEmail(String(email).trim().toLowerCase());
    if (!user || user.disabledAt) return stamp({ error: GENERIC });
    const methods = await signInMethods(user.id);
    if (methods && (methods.totp || methods.passkey)) {
      const opened = await openTicket({ userId: user.id, purpose: "SIGN_IN" });
      return opened.ok ? factorStep(opened.challengeId, methods) : issueError(opened);
    }
    const issued = await issueChallenge({ userId: user.id, email: user.email, name: user.name, purpose: "SIGN_IN" });
    return issued.ok ? codeStep(issued.challengeId, user.email) : issueError(issued);
  }
  if (refused) return stamp({ error: messageFor(refused.code) });

  redirect(target);
}

/** A wrong code keeps the step open; anything else needs a fresh sign-in. */
function verifyError(result: Extract<VerifyResult, { ok: false }>, keep: SignInState): SignInState {
  return result.reason === "invalid" ? stamp({ ...keep, error: CODE_ERRORS.invalid }) : stamp({ error: CODE_ERRORS[result.reason] });
}

export async function completeSignIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  if (!(await hasValidUnlock())) return stamp({ error: GENERIC });
  const open = await ticket(formData.get("challengeId"));
  if (!open) return stamp({ error: EXPIRED });

  const code = normalizeCode(String(formData.get("code") ?? ""));
  const keep: SignInState = { error: null, challengeId: open.challengeId, step: "email" };
  if (!code) return stamp({ ...keep, error: "Enter the 6 digit code." });

  const verified = await verifyChallenge({ challengeId: open.challengeId, userId: open.owner.userId, email: open.owner.user.email, purpose: "SIGN_IN", code });
  if (!verified.ok) return verifyError(verified, keep);
  return finish(open.challengeId, formData.get("callbackUrl"));
}

/** The second step with an authenticator-app code or a recovery code (`method`). */
export async function completeFactorSignIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  if (!(await hasValidUnlock())) return stamp({ error: GENERIC });
  const open = await ticket(formData.get("challengeId"));
  if (!open) return stamp({ error: EXPIRED });

  const method = formData.get("method") === "recovery" ? "recovery" : "totp";
  const code = String(formData.get("code") ?? "").trim();
  const keep = factorStep(open.challengeId, open.methods);
  if (!open.methods[method]) return stamp({ ...keep, error: "That sign-in method is not set up for this account." });
  if (!code) return stamp({ ...keep, error: method === "totp" ? "Enter the 6 digit code from your app." : "Enter one of your recovery codes." });

  const input = { challengeId: open.challengeId, userId: open.owner.userId, email: open.owner.user.email, purpose: "SIGN_IN" as const, code };
  const verified = method === "totp" ? await verifyTotp(input) : await verifyRecoveryCode(input);
  if (!verified.ok) return verifyError(verified, keep);
  return finish(open.challengeId, formData.get("callbackUrl"));
}

/** Emails a code: a new one on the email step, or instead of the app where the account allows it. */
export async function resendSignInCode(_previous: SignInState, formData: FormData): Promise<SignInState> {
  if (!(await hasValidUnlock())) return stamp({ error: GENERIC });
  const open = await ticket(formData.get("challengeId"));
  if (!open) return stamp({ error: EXPIRED });
  // A role that must use a strong factor cannot fall back to email once it has one.
  if (!open.methods.email) return factorStep(open.challengeId, open.methods, NO_EMAIL);

  // Wrong tries carry over to the new code, so asking again is no way around the limit.
  const issued = await issueChallenge({ userId: open.owner.userId, email: open.owner.user.email, name: open.owner.user.name, purpose: "SIGN_IN" });
  return issued.ok ? codeStep(issued.challengeId, open.owner.user.email, `A code was sent to ${open.owner.user.email}.`) : issueError(issued);
}

export type PasskeyOptionsResult = { ok: true; passkeyChallengeId: string; options: unknown } | { ok: false; error: string };

/** WebAuthn options for the passkey button on the second step. */
export async function passkeySignInOptions(challengeId: string): Promise<PasskeyOptionsResult> {
  if (!(await hasValidUnlock())) return { ok: false, error: GENERIC };
  const open = await ticket(challengeId);
  if (!open) return { ok: false, error: EXPIRED };
  if (!open.methods.passkey) return { ok: false, error: "No passkey is set up for this account." };
  const created = await passkeys.authenticationOptions(open.owner.userId);
  return created ? { ok: true, passkeyChallengeId: created.challengeId, options: created.options } : { ok: false, error: "No passkey is set up for this account." };
}

/** Verifies the browser's passkey assertion and starts the session. */
export async function completePasskeySignIn(input: {
  challengeId: string;
  passkeyChallengeId: string;
  response: AuthenticationResponseJSON;
  callbackUrl: string;
}): Promise<SignInState> {
  if (!(await hasValidUnlock())) return stamp({ error: GENERIC });
  const open = await ticket(input.challengeId);
  if (!open) return stamp({ error: EXPIRED });
  if (!input.response || typeof input.response.id !== "string" || typeof input.passkeyChallengeId !== "string") {
    return factorStep(open.challengeId, open.methods, "The passkey answer was not readable. Try again.");
  }

  const verified = await passkeys.verifyAuthentication({
    ticketId: open.challengeId,
    challengeId: input.passkeyChallengeId,
    userId: open.owner.userId,
    email: open.owner.user.email,
    response: input.response,
  });
  if (!verified.ok) {
    return verified.reason === "invalid"
      ? factorStep(open.challengeId, open.methods, "That passkey did not work. Try again or use another method.")
      : stamp({ error: CODE_ERRORS[verified.reason] });
  }
  return finish(open.challengeId, input.callbackUrl);
}

export async function signOutAction(): Promise<void> {
  const user = await getOptionalUser();
  if (user) {
    await revokeSession(user.sid, { userId: user.id, reason: "sign_out" });
    await auditSafe({
      action: "auth.logout",
      actor: { id: user.id, email: user.email },
      entityType: "UserSession",
      entityId: user.sid,
    });
  }
  await signOutAndRedirect("/");
}
