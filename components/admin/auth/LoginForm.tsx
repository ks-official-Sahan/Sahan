"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import Link from "next/link";
import { useActionState, useState, useSyncExternalStore, useTransition } from "react";

import { PasswordInput } from "@/components/admin/ui/PasswordField";
import {
  completeFactorSignIn,
  completePasskeySignIn,
  completePasswordlessSignIn,
  completeSignIn,
  passkeySignInOptions,
  passwordlessSignInOptions,
  resendSignInCode,
  startSignIn,
  type SignInState,
} from "@/lib/actions/auth";

const initial: SignInState = { error: null };

type Method = "passkey" | "totp" | "email";
type Choice = Method | "recovery";
type PasskeyOptions = Parameters<typeof startAuthentication>[0]["optionsJSON"];

const METHODS: readonly Method[] = ["passkey", "totp", "email"];
const METHOD_LABEL: Record<Method, string> = { passkey: "Passkey", totp: "Authenticator app", email: "Email code" };
// The method picked last time on this browser, a convenience only.
const METHOD_KEY = "sahan:admin:sign-in-method";
// Wrong answers on the second step before recovery codes are offered.
const FAILURES_BEFORE_RECOVERY = 2;
// Event handlers stamp their results; a module-level clock keeps render pure.
const clock = () => Date.now();
const PROMPT_CLOSED = "The passkey prompt was closed or is not available here. Try again or use another method.";

const field =
  "mt-1.5 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const primary =
  "inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";
const secondary =
  "inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";
const link =
  "text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";
const tab =
  "flex-1 rounded px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm text-muted-foreground hover:text-foreground";

function rememberedMethod(): Method | null {
  try {
    const value = window.localStorage.getItem(METHOD_KEY);
    return METHODS.find((method) => method === value) ?? null;
  } catch {
    return null;
  }
}

const noSubscription = () => () => {};

function rememberMethod(method: Method) {
  try {
    window.localStorage.setItem(METHOD_KEY, method);
  } catch {
    // Storage blocked: the default order applies next time.
  }
}

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

function CodeField({ id, label, numeric, autoFocus }: { id: string; label: string; numeric: boolean; autoFocus: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name="code"
        inputMode={numeric ? "numeric" : "text"}
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        required
        maxLength={20}
        className={`${field} ${numeric ? "tracking-[0.3em]" : "tracking-[0.15em]"}`}
      />
    </div>
  );
}

/**
 * Signing in: the password, then, for an account with a second factor, any
 * method the account set up (passkey, authenticator app or emailed code), with
 * recovery codes as the last resort. With `passkeySignIn`, a passkey alone can
 * sign in from the first step. The step's state is the result of the last
 * action, so a reload starts again from the password.
 */
export default function LoginForm({ callbackUrl, notice, passkeySignIn }: { callbackUrl: string; notice: string | null; passkeySignIn: boolean }) {
  const [failures, setFailures] = useState(0);
  // A wrong answer keeps the second step open with an error: count it.
  const counted =
    (action: (previous: SignInState, formData: FormData) => Promise<SignInState>) =>
    async (previous: SignInState, formData: FormData) => {
      const next = await action(previous, formData);
      if (next.error && next.challengeId) setFailures((count) => count + 1);
      return next;
    };

  const [first, startAction, startPending] = useActionState(startSignIn, initial);
  const [emailed, codeAction, codePending] = useActionState(counted(completeSignIn), initial);
  const [factor, factorAction, factorPending] = useActionState(counted(completeFactorSignIn), initial);
  const [resent, resendAction, resendPending] = useActionState(resendSignInCode, initial);
  const [passkey, setPasskey] = useState<SignInState>(initial);
  const [passkeyPending, startPasskey] = useTransition();
  const [chosen, setChosen] = useState<Choice | null>(null);
  const remembered = useSyncExternalStore(noSubscription, rememberedMethod, () => null);

  const state = newest(first, emailed, factor, resent, passkey);
  const { challengeId, methods } = state;
  const shownNotice = state.notice ?? (challengeId ? null : notice);

  function passkeyFailed(error: string) {
    setPasskey({ ...state, error, at: clock() });
    if (state.challengeId) setFailures((count) => count + 1);
  }

  function verifyWithPasskey(id: string) {
    startPasskey(async () => {
      const options = await passkeySignInOptions(id);
      if (!options.ok) return passkeyFailed(options.error);
      try {
        const response = await startAuthentication({ optionsJSON: options.options as PasskeyOptions });
        // Redirects on success; returns a state only when something went wrong.
        const next = await completePasskeySignIn({ challengeId: id, passkeyChallengeId: options.passkeyChallengeId, response, callbackUrl });
        setPasskey(next);
        if (next.error && next.challengeId) setFailures((count) => count + 1);
      } catch {
        passkeyFailed(PROMPT_CLOSED);
      }
    });
  }

  function signInWithPasskeyOnly() {
    startPasskey(async () => {
      const options = await passwordlessSignInOptions();
      if (!options.ok) return setPasskey({ error: options.error, at: clock() });
      try {
        const response = await startAuthentication({ optionsJSON: options.options as PasskeyOptions });
        setPasskey(await completePasswordlessSignIn({ response, callbackUrl }));
      } catch {
        setPasskey({ error: PROMPT_CLOSED, at: clock() });
      }
    });
  }

  // The method on screen: the one picked now, then email once a code was sent,
  // then the one used last time on this browser, then the strongest offered.
  const offered = methods ? METHODS.filter((method) => methods[method]) : [];
  const fallback = offered.find((method) => method === remembered) ?? offered[0];
  const active: Choice | undefined =
    chosen === "recovery" && methods?.recovery
      ? "recovery"
      : chosen && chosen !== "recovery" && offered.includes(chosen)
        ? chosen
        : state.emailSent && methods?.email
          ? "email"
          : (fallback ?? (methods?.recovery ? "recovery" : undefined));
  const suggestRecovery = Boolean(methods?.recovery) && active !== "recovery" && failures >= FAILURES_BEFORE_RECOVERY;

  function choose(choice: Choice) {
    setChosen(choice);
    if (choice !== "recovery") rememberMethod(choice);
  }

  const startOver = (
    <a href={`?${new URLSearchParams({ callbackUrl })}`} className={link}>
      Start over
    </a>
  );
  const hidden = (
    <>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <input type="hidden" name="challengeId" value={challengeId ?? ""} />
    </>
  );

  const lead = !challengeId
    ? "Use your admin account."
    : active === "passkey"
      ? "Use the passkey saved on this device, your phone or a security key."
      : active === "totp"
        ? "Enter the 6 digit code from your authenticator app."
        : active === "email"
          ? state.emailSent
            ? "Enter the code we emailed you."
            : "We will email a 6 digit code to your address."
          : "Enter one of your recovery codes. Each one works once.";

  return (
    <div className="rounded-lg border border-border bg-card p-6 text-card-foreground">
      <h1 className="text-xl font-semibold tracking-tight">{challengeId ? "Confirm it is you" : "Sign in"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{lead}</p>

      {shownNotice ? (
        <p role="status" className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm">
          {shownNotice}
        </p>
      ) : null}

      {challengeId && methods ? (
        <div className="mt-5 space-y-4">
          {offered.length > 1 && active !== "recovery" ? (
            <div role="group" aria-label="Verification method" className="flex gap-1 rounded-md bg-muted p-1">
              {offered.map((method) => (
                <button key={method} type="button" aria-pressed={active === method} onClick={() => choose(method)} className={tab}>
                  {METHOD_LABEL[method]}
                </button>
              ))}
            </div>
          ) : null}

          {active === "passkey" ? (
            <button type="button" onClick={() => verifyWithPasskey(challengeId)} disabled={passkeyPending} className={primary}>
              {passkeyPending ? "Waiting for your passkey..." : "Use a passkey"}
            </button>
          ) : null}

          {active === "totp" || active === "recovery" ? (
            <form action={factorAction} className="space-y-4" noValidate>
              {hidden}
              <input type="hidden" name="method" value={active} />
              <CodeField
                key={active}
                id="factor-code"
                label={active === "totp" ? "6 digit code" : "Recovery code"}
                numeric={active === "totp"}
                autoFocus
              />
              <button type="submit" disabled={factorPending} className={primary}>
                {factorPending ? "Checking..." : "Verify and sign in"}
              </button>
            </form>
          ) : null}

          {active === "email" && state.emailSent ? (
            <form action={codeAction} className="space-y-4" noValidate>
              {hidden}
              <CodeField id="email-code" label="6 digit code" numeric autoFocus />
              <button type="submit" disabled={codePending} className={primary}>
                {codePending ? "Checking..." : "Verify and sign in"}
              </button>
            </form>
          ) : null}

          {active === "email" ? (
            <form action={resendAction}>
              <input type="hidden" name="challengeId" value={challengeId} />
              <button type="submit" disabled={resendPending} className={state.emailSent ? link : primary}>
                {resendPending ? "Sending..." : state.emailSent ? "Send a new code" : "Email me a code"}
              </button>
            </form>
          ) : null}

          <ErrorText error={state.error} />

          {suggestRecovery ? (
            <p role="status" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
              Still not working?{" "}
              <button type="button" onClick={() => choose("recovery")} className="font-medium underline underline-offset-4">
                Use a recovery code
              </button>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {active === "recovery" && offered.length > 0 ? (
              <button type="button" onClick={() => setChosen(null)} className={link}>
                Use another method
              </button>
            ) : methods.recovery && !suggestRecovery ? (
              <button type="button" onClick={() => choose("recovery")} className={link}>
                Can&apos;t use these?
              </button>
            ) : (
              <span />
            )}
            {startOver}
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <form action={startAction} className="space-y-4" noValidate>
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
          </form>

          {passkeySignIn ? (
            <>
              <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <button type="button" onClick={signInWithPasskeyOnly} disabled={passkeyPending} className={secondary}>
                {passkeyPending ? "Waiting for your passkey..." : "Sign in with a passkey"}
              </button>
            </>
          ) : null}

          <Link href="/admin/forgot-password" className={`${link} block text-center`}>
            Forgot your password?
          </Link>
        </div>
      )}
    </div>
  );
}
