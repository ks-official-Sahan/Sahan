import "server-only";

import { cookies } from "next/headers";

import { verifyUnlockCookie, type UnlockKeys } from "./login-unlock";

/**
 * Does this request carry a valid unlock cookie? The proxy checks it too, but
 * it lets a request with any signed session through, and a revoked session is
 * still a signed one. The login page and the sign-in action therefore check
 * again, so the form stays hidden from anyone who does not hold the unlock
 * secret.
 *
 * `keys` and `cookieName` are the app's own (resolve `keys` once from env with
 * `unlockKeysFromEnv`, and `cookieName` from `defineAuthKit`'s
 * `cookies.unlock`, `resolveCookieName`d for the environment) — this function
 * itself never reads `process.env` or a hardcoded cookie name, so it stays
 * unit-testable and reusable across apps.
 */
export async function hasValidUnlock(keys: UnlockKeys | null, cookieName: string): Promise<boolean> {
  if (!keys) return false;
  const value = (await cookies()).get(cookieName)?.value;
  return verifyUnlockCookie(value, Date.now(), keys);
}
