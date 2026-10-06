import NextAuth, { AuthError } from "next-auth";

import { createAuthConfig } from "../config";
import { passwordFingerprint } from "../session/state";
import type { AuthEngine, AuthEngineOptions, EngineSession, SignInRefusalCode } from "./types";

// auth-kit on next-auth (Next.js only): a credentials provider and a JWT that
// points at the user_sessions row. `database` is not used.

export type * from "./types";

const on = (value: string | undefined) => /^(1|true|yes|on)$/i.test(value?.trim() ?? "");

function codeOf(error: unknown): SignInRefusalCode | null {
  if (!(error instanceof AuthError)) return null;
  const code = (error as AuthError & { code?: unknown }).code;
  return code === "limited" || code === "mfa_required" ? code : "invalid";
}

export function createAuthEngine(options: AuthEngineOptions): AuthEngine {
  const { auth, signIn, signOut, unstable_update } = NextAuth(() =>
    createAuthConfig({
      ...options.signIn,
      sessionCookieName: options.sessionCookieName,
      loginPath: options.loginPath,
      defaultRole: options.defaultRole,
      authTrustHost: options.nextAuth?.trustHost ?? on(process.env.AUTH_TRUST_HOST),
      authDebug: options.nextAuth?.debug ?? on(process.env.AUTH_DEBUG),
      production: options.production,
    })
  );

  return {
    name: "next-auth",
    checkPasswordFingerprint: true,
    sessionSource: () => auth() as Promise<EngineSession | null>,
    async signIn(credentials) {
      try {
        // `signIn` reports a refusal by throwing or, depending on the version, by returning a URL.
        const result: unknown = await signIn("credentials", { ...credentials, redirect: false });
        if (typeof result === "string" && result.includes("error=")) {
          const code = new URL(result, "http://local").searchParams.get("code");
          return { code: code === "limited" || code === "mfa_required" ? code : "invalid" };
        }
        return null;
      } catch (error) {
        const code = codeOf(error);
        if (code === null) throw error;
        return { code };
      }
    },
    async signOut(redirectTo) {
      await signOut({ redirectTo });
      throw new Error("unreachable: signOut redirects");
    },
    async keepSessionAfterPasswordChange(passwordHash) {
      // The JWT gets the new password fingerprint, so this session survives its own password change.
      await unstable_update({ pwf: passwordFingerprint(passwordHash, options.signIn.authSecret) });
    },
  };
}
