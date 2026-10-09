import type { BetterAuthClientOptions, BetterAuthClientPlugin } from "better-auth/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * The user fields auth-kit's server plugin adds. The client can read them;
 * the server never accepts them from a client (`input: false`).
 */
export const authKitUserFields = () =>
  inferAdditionalFields({
    user: {
      role: { type: "string", required: false, input: false },
      mustChangePassword: { type: "boolean", required: false, input: false },
    },
  });

export type AuthKitSignInResult = { ok: true } | { ok: false; code: "invalid" | "limited" | "mfa_required" | "unavailable" };

/** The part of Better Auth's client fetch these actions use. */
type AuthFetch = (path: string, options: { method: "POST"; body: unknown }) => Promise<{ error: unknown }>;

const REFUSALS = new Set(["invalid", "limited", "mfa_required"]);

/**
 * Client half of auth-kit's `authKitSessions` server plugin (Better Auth on
 * auth-kit's tables): `authClient.authKit.signIn({ email, password })`, or
 * `{ challengeId }` once the emailed code is verified, and
 * `authClient.authKit.signOut()`, which also revokes the session row.
 */
export const authKitSessionsClient = () =>
  ({
    id: "auth-kit-sessions",
    getActions: ($fetch: AuthFetch, $store: { notify(signal: string): void }) => ({
      authKit: {
        async signIn(credentials: { email: string; password: string } | { challengeId: string }): Promise<AuthKitSignInResult> {
          const { error } = await $fetch("/auth-kit/sign-in", { method: "POST", body: credentials });
          if (!error) {
            $store.notify("$sessionSignal");
            return { ok: true };
          }
          const code = (error as { code?: unknown }).code;
          return { ok: false, code: typeof code === "string" && REFUSALS.has(code) ? (code as "invalid" | "limited" | "mfa_required") : "unavailable" };
        },
        async signOut(): Promise<void> {
          await $fetch("/auth-kit/clear-session", { method: "POST", body: {} });
          $store.notify("$sessionSignal");
        },
      },
    }),
  }) satisfies BetterAuthClientPlugin;

export interface AuthKitClientOptions<TPlugins extends BetterAuthClientPlugin[]> {
  /** URL of the API that mounts Better Auth (its `/api/auth/*` routes). */
  baseURL: string;
  /**
   * Better Auth client plugins. In a browser none are needed. On Expo pass
   * `expoClient({ scheme, storagePrefix, storage: SecureStore })` from
   * "@better-auth/expo/client": it keeps the session cookie in SecureStore and
   * sends it, with the app's `expo-origin`, on every auth request.
   */
  plugins: TPlugins;
  /** Better Auth fetch options, for example `customFetchImpl` in tests. */
  fetchOptions?: BetterAuthClientOptions["fetchOptions"];
}

/**
 * A Better Auth React client, for React web and React Native, that knows
 * auth-kit's user fields (`role`, `mustChangePassword`) and its sign-in
 * (`authClient.authKit`).
 */
export function createAuthKitClient<const TPlugins extends BetterAuthClientPlugin[]>(options: AuthKitClientOptions<TPlugins>) {
  return createAuthClient({
    baseURL: options.baseURL,
    fetchOptions: options.fetchOptions,
    plugins: [...options.plugins, authKitUserFields(), authKitSessionsClient()],
  });
}
