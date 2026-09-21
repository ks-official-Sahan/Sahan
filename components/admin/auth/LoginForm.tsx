"use client";

import { useActionState } from "react";

import { startSignIn, type SignInState } from "@/lib/actions/auth";

const initial: SignInState = { error: null };

const field =
  "mt-1.5 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function LoginForm({
  callbackUrl,
  notice,
}: {
  callbackUrl: string;
  notice: string | null;
}) {
  const [state, action, pending] = useActionState(startSignIn, initial);

  return (
    <div className="rounded-lg border border-border bg-card p-6 text-card-foreground">
      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Use your admin account.</p>

      {notice ? (
        <p role="status" className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}

      <form action={action} className="mt-5 space-y-4" noValidate>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
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
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={1024}
            className={field}
          />
        </div>

        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
