import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Hidden login: /admin/login stays a 404 until the visitor opens it once with
// ?secret=<ADMIN_LOGIN_UNLOCK_SECRET>. The proxy then sets a signed cookie that
// lasts two hours. No server-only import: the proxy runs this on the Node.js
// runtime. Design record: docs/plan/admin-cms-adr.md, section 6.2.

export const UNLOCK_COOKIE = "sahan_admin_unlock";
export const UNLOCK_QUERY = "secret";
export const UNLOCK_TTL_SECONDS = 2 * 60 * 60;

/** A cookie issued this far in the future is refused. */
const CLOCK_SKEW_MS = 60_000;

export interface UnlockKeys {
  authSecret: string;
  unlockSecret: string;
}

/** Both secrets must be set, otherwise the login stays locked. */
export function unlockKeysFromEnv(
  env: Record<string, string | undefined> = process.env
): UnlockKeys | null {
  const authSecret = env.AUTH_SECRET;
  const unlockSecret = env.ADMIN_LOGIN_UNLOCK_SECRET;
  if (!authSecret || !unlockSecret) return null;
  return { authSecret, unlockSecret };
}

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/** Compares through SHA-256 digests, so the length of either value never leaks. */
export function constantTimeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

/** Does the value from the URL match the configured unlock secret? */
export function isUnlockSecret(given: string | null | undefined, keys: UnlockKeys): boolean {
  if (given === null || given === undefined || given.length === 0) return false;
  return constantTimeEqual(given, keys.unlockSecret);
}

// The key needs AUTH_SECRET as well, so a leaked cookie cannot be used to guess
// a short unlock secret offline, and rotating either secret invalidates every
// cookie already issued.
function cookieKey(keys: UnlockKeys): Buffer {
  return createHmac("sha256", keys.authSecret)
    .update(`admin-unlock:v1:${sha256(keys.unlockSecret).toString("hex")}`)
    .digest();
}

function mac(issuedAt: string, keys: UnlockKeys): string {
  return createHmac("sha256", cookieKey(keys))
    .update(`admin-unlock:v1:${issuedAt}`)
    .digest("base64url");
}

/** `issuedAtMs.base64url(HMAC)` */
export function signUnlockCookie(now: number, keys: UnlockKeys): string {
  const issuedAt = String(Math.trunc(now));
  return `${issuedAt}.${mac(issuedAt, keys)}`;
}

export function verifyUnlockCookie(
  value: string | null | undefined,
  now: number,
  keys: UnlockKeys
): boolean {
  if (!value || value.length > 128) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const issuedAt = value.slice(0, dot);
  if (!/^\d{10,15}$/.test(issuedAt)) return false;
  if (!constantTimeEqual(value.slice(dot + 1), mac(issuedAt, keys))) return false;

  const issued = Number(issuedAt);
  if (issued > now + CLOCK_SKEW_MS) return false;
  if (now - issued > UNLOCK_TTL_SECONDS * 1000) return false;
  return true;
}

/**
 * Lax and not Strict on purpose: the unlock link is often opened from a chat or
 * an email. With Strict, the redirect that follows the ?secret= request counts
 * as cross-site and the browser would not send the cookie it has just received.
 * The cookie only decides whether the login page is visible; every action still
 * checks the origin and the session.
 */
export function unlockCookieOptions(production: boolean) {
  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax" as const,
    path: "/admin",
    maxAge: UNLOCK_TTL_SECONDS,
  };
}
