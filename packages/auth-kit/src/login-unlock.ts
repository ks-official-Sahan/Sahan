import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Hidden login: the login page stays a 404 until the visitor opens it once
// with ?<UNLOCK_QUERY>=<secret>. The proxy then sets a signed cookie that
// lasts two hours. No server-only import: the proxy runs this on the Node.js
// runtime.
//
// The cookie's *name* is app policy (see `defineAuthKit`'s `cookies.unlock`,
// resolved for the environment with `resolveCookieName` from ./constants) and
// is not exported from here; every function below takes it, or the cookie
// value, as a parameter.

export const UNLOCK_QUERY = "secret";
export const UNLOCK_TTL_SECONDS = 2 * 60 * 60;

/** A cookie issued this far in the future is refused. */
const CLOCK_SKEW_MS = 60_000;

export interface UnlockKeys {
  authSecret: string;
  unlockSecret: string;
}

/**
 * Is the hidden-login gate on? Only when ADMIN_LOGIN_UNLOCK_SECRET is set.
 * Without it the login page is shown to every visitor, with the usual
 * rate limits, and no unlock cookie is issued or required.
 */
export function loginUnlockEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.ADMIN_LOGIN_UNLOCK_SECRET?.trim());
}

/** Both secrets must be set, otherwise no unlock cookie can be issued or verified. */
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

// Sign-in links: a short code that unlocks the login page like ?secret= does,
// without putting the secret in a URL. `<expiry>.<tag>`: the expiry in Unix
// seconds, base 36, and a 96-bit MAC of it under the same key as the cookie
// (another label, so neither value passes as the other). Stateless, so a
// link cannot be revoked one by one: rotating either secret ends every link
// at once, and the lifetime is capped.

export const SIGN_IN_LINK_DEFAULT_DAYS = 14;
export const SIGN_IN_LINK_MAX_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
const SIGN_IN_LINK = /^([0-9a-z]{1,9})\.([A-Za-z0-9_-]{16})$/;

/** A day count from config, whole and within 1..SIGN_IN_LINK_MAX_DAYS; anything else is the default. */
export function signInLinkDays(value: string | number | null | undefined): number {
  const days = typeof value === "number" ? value : Number(value?.trim() || Number.NaN);
  if (!Number.isFinite(days)) return SIGN_IN_LINK_DEFAULT_DAYS;
  return Math.min(SIGN_IN_LINK_MAX_DAYS, Math.max(1, Math.trunc(days)));
}

function linkTag(expiry: string, keys: UnlockKeys): string {
  return createHmac("sha256", cookieKey(keys))
    .update(`admin-sign-in-link:v1:${expiry}`)
    .digest()
    .subarray(0, 12)
    .toString("base64url");
}

/** A code valid for `days` (clamped to 1..90) from `now`. About 23 characters. */
export function signSignInLink(now: number, days: number, keys: UnlockKeys): string {
  const expiry = Math.ceil((now + signInLinkDays(days) * DAY_MS) / 1000).toString(36);
  return `${expiry}.${linkTag(expiry, keys)}`;
}

/** Is the code one this server signed, unexpired, and within the lifetime cap? */
export function verifySignInLink(
  code: string | null | undefined,
  now: number,
  keys: UnlockKeys
): boolean {
  const match = code ? SIGN_IN_LINK.exec(code) : null;
  if (!match) return false;
  const [, expiry, tag] = match;
  if (!constantTimeEqual(tag, linkTag(expiry, keys))) return false;
  const expiresAt = parseInt(expiry, 36) * 1000;
  return expiresAt > now && expiresAt - now <= SIGN_IN_LINK_MAX_DAYS * DAY_MS + CLOCK_SKEW_MS;
}

/**
 * Lax and not Strict on purpose: the unlock link is often opened from a chat or
 * an email. With Strict, the redirect that follows the ?secret= request counts
 * as cross-site and the browser would not send the cookie it has just received.
 * The cookie only decides whether the login page is visible; every action still
 * checks the origin and the session.
 *
 * Path is `/` in production and the narrower `/admin` in development: a
 * `__Host-`-prefixed cookie name (see `resolveCookieName`) is only valid with
 * `Path=/`, so the production cookie widens to match. This only broadens
 * where the browser *sends* the cookie back — every reader still only cares
 * about admin paths — so it is not a new capability, just a wider send scope.
 */
export function unlockCookieOptions(production: boolean) {
  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax" as const,
    path: production ? "/" : "/admin",
    maxAge: UNLOCK_TTL_SECONDS,
  };
}
