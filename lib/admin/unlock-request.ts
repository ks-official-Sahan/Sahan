import "server-only";

import { cookies } from "next/headers";

import { UNLOCK_COOKIE, unlockKeysFromEnv, verifyUnlockCookie } from "./login-unlock";

/**
 * Does this request carry a valid unlock cookie? The proxy checks it too, but it
 * lets a request with any signed session through, and a revoked session is still
 * a signed one. The login page and the sign-in action therefore check again, so
 * the form stays hidden from anyone who does not hold the unlock secret
 * (docs/plan/admin-cms-adr.md, section 6.2, point 5).
 */
export async function hasValidUnlock(): Promise<boolean> {
  const keys = unlockKeysFromEnv();
  if (!keys) return false;
  const value = (await cookies()).get(UNLOCK_COOKIE)?.value;
  return verifyUnlockCookie(value, Date.now(), keys);
}
