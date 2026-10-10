"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import { PasswordInput } from "@/components/admin/ui/PasswordField";
import {
  completeFactorSignIn,
  completePasskeySignIn,
  completeSignIn,
  passkeySignInOptions,
  resendSignInCode,
  startSignIn,
  type SignInState,
} from "@/lib/actions/auth";

const initial: SignInState = { error: null };

const field =
  "mt-1.5 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const primary =
  "inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";
const secondary =
  "inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";
const link =
  "text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

/** The newest result of the step actions decides what is on screen. */
function newest(...states: SignInState[]): SignInState {
  return states.reduce((best, state) => ((state.at ?? 0) > (best.at ?? 0) ? state : best), initial);
}

function ErrorText({ error }: { error: string | null | undefined }) {
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null;
}

/**
 * Two steps for an account with a second factor: the password, then an
 * emailed code, an authenticator-app code, a passkey or a recovery code. The
 * step's state is the result of the last action, so a reload starts again
 * from the password.
 */
export default function LoginForm({ callbackUrl, notice }: { callbackUrl: string; notice: string | null }) {
  const [first, startAction, startPending] = useActionState(startSignIn, initial);
  const [second, codeAction, codePending] = useActionState(completeSignIn, initial);
  const [factor, factorAction, factorPending] = useActionState(completeFactorSignIn, initial);
  const [resent, resendAction, resendPending] = useActionState(resendSignInCode, initial);
  const [passkey, setPasskey] = useState<SignInState>(initial);
  const [passkeyPending, startPasskey] = useTransition();
  const [useRecovery, setUseRecovery] = useState(false);

  const state = newest(first, second, factor, resent, passkey);
  const challengeId = state.challengeId;
  const shownNotice = state.notice ?? (challengeId ? null : notice);

  function signInWithPasskey(id: string) {
    startPasskey(async () => {
      const options = await passkeySignInOptions(id);
      if (!options.ok) {
        setPasskey({ ...state, error: options.error, at: Date.now() });
        return;
      }
      try {
        const response = await startAuthentication({ optionsJSON: options.options as Parameters<typeof startAuthentication>[0]["optionsJSON"] });
        // Redirects on success; returns a state only when something went wrong.
        setPasskey(await completePasskeySignIn({ challengeId: id, passkeyChallengeId: options.passkeyChallengeId, response, callbackUrl }));
      } catch {
        setPasskey({ ...state, error: "The passkey prompt was closed or is not available here. Try again or use another method.", at: Date.now() });
      }
    });
  }

  const heading = !challengeId ? "Sign in" : state.step === "factor" ? "Confirm it is you" : "Check your email";
  const lead = !challengeId
    ? "Use your admin account."
    : state.step === "factor"
      ? "Use your authenticator app, a passkey or a recovery code."
      : "Enter the code we sent you.";

  return (
    <div className="rounded-lg border border-border bg-card p-6 text-card-foreground">
      <h1 className="text-xl font-semibold tracking-tight">{heading}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{lead}</p>

      {shownNotice ? (
        <p role="status" className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm">
          {shownNotice}
        </p>
      ) : null}

      {challengeId && state.step === "factor" && state.methods ? (
        <div className="mt-5 space-y-4">
          {state.methods.passkey ? (
            <button type="button" onClick={() => signInWithPasskey(challengeId)} disabled={passkeyPending} className={primary}>
              {passkeyPending ? "Waiting for your passkey..." : "Use a passkey"}
            </button>
          ) : null}

          {state.methods.totp || state.methods.recovery ? (
            <form action={factorAction} className="space-y-4" noValidate>
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
              <input type="hidden" name="challengeId" value={challengeId} />
              <input type="hidden" name="method" value={useRecovery || !state.methods.totp ? "recovery" : "totp"} />
              <div>
                <label htmlFor="factor-code" className="text-sm font-medium">
                  {useRecovery || !state.methods.totp ? "Recovery code" : "6 digit code from your authenticator app"}
                </label>
                <input
                  id="factor-code"
                  key={useRecovery ? "recovery" : "totp"}
                  name="code"
                  inputMode={useRecovery || !state.methods.totp ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  autoFocus={!state.methods.passkey}
                  required
                  maxLength={20}
                  className={`${field} tracking-[0.2em]`}
                />
              </div>
              <button type="submit" disabled={factorPending} className={state.methods.passkey ? secondary : primary}>
                {factorPending ? "Checking..." : "Verify and sign in"}
              </button>
            </form>
          ) : null}

          <ErrorText error={state.error} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            {state.methods.totp && state.methods.recovery ? (
              <button type="button" onClick={() => setUseRecovery((value) => !value)} className={link}>
                {useRecovery ? "Use the authenticator app" : "Use a recovery code"}
              </button>
            ) : null}
            {state.methods.email ? (
              <form action={resendAction}>
                <input type="hidden" name="challengeId" value={challengeId} />
                <button type="submit" disabled={resendPending} className={link}>
                  {resendPending ? "Sending..." : "Email me a code instead"}
                </button>
              </form>
            ) : null}
            <a href={`?${new URLSearchParams({ callbackUrl })}`} className={link}>
              Start over
            </a>
          </div>
        </div>
      ) : challengeId ? (
        <>
          <form action={codeAction} className="mt-5 space-y-4" noValidate>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <input type="hidden" name="challengeId" value={challengeId} />
            <div>
              <label htmlFor="code" className="text-sm font-medium">
                6 digit code
              </label>
              <input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                autoFocus
                required
                maxLength={10}
                className={`${field} tracking-[0.3em]`}
              />
            </div>
            <ErrorText error={state.error} />
            <button type="submit" disabled={codePending} className={primary}>
              {codePending ? "Checking..." : "Verify and sign in"}
            </button>
          </form>
          <form action={resendAction} className="mt-3 flex items-center justify-between">
            <input type="hidden" name="challengeId" value={challengeId} />
            <button type="submit" disabled={resendPending} className={link}>
              {resendPending ? "Sending..." : "Send a new code"}
            </button>
            <a href={`?${new URLSearchParams({ callbackUrl })}`} className={link}>
              Start over
            </a>
          </form>
        </>
      ) : (
        <form action={startAction} className="mt-5 space-y-4" noValidate>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />

          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username webauthn"
              autoFocus
              required
              maxLength={254}
              className={field}
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <PasswordInput id="password" name="password" autoComplete="current-password" required maxLength={1024} className="mt-1.5" />
          </div>

          <ErrorText error={state.error} />

          <button type="submit" disabled={startPending} className={primary}>
            {startPending ? "Signing in..." : "Sign in"}
          </button>

          <Link href="/admin/forgot-password" className={`${link} block text-center`}>
            Forgot your password?
          </Link>
        </form>
      )}
    </div>
  );
}
