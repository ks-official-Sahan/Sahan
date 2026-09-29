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

export interface AuthKitClientOptions<TPlugins extends BetterAuthClientPlugin[]> {
  /** URL of the API that mounts Better Auth (its `/api/auth/*` routes). */
  baseURL: string;
  /**
   * Better Auth client plugins. On Expo pass
   * `expoClient({ scheme, storagePrefix, storage: SecureStore })` from
   * "@better-auth/expo/client": it keeps the session cookie in SecureStore and
   * sends it, with the app's `expo-origin`, on every auth request.
   */
  plugins: TPlugins;
  /** Better Auth fetch options, for example `customFetchImpl` in tests. */
  fetchOptions?: BetterAuthClientOptions["fetchOptions"];
}

/** A Better Auth React client that knows auth-kit's user fields (`role`, `mustChangePassword`). */
export function createAuthKitClient<const TPlugins extends BetterAuthClientPlugin[]>(options: AuthKitClientOptions<TPlugins>) {
  return createAuthClient({
    baseURL: options.baseURL,
    fetchOptions: options.fetchOptions,
    plugins: [...options.plugins, authKitUserFields()],
  });
}
