import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

import {
  isUnlockSecret,
  signUnlockCookie,
  UNLOCK_COOKIE,
  UNLOCK_QUERY,
  unlockCookieOptions,
  unlockKeysFromEnv,
  verifyUnlockCookie,
} from "@/lib/admin/login-unlock";
import {
  bypassKeysFromEnv,
  BYPASS_COOKIE,
  BYPASS_QUERY,
  bypassCookieOptions,
  isMaintenanceExempt,
  isValidBypassSecret,
  signBypassCookie,
  verifyBypassCookie,
} from "@/lib/admin/maintenance-bypass";
import { LOCKED_PATH, LOGIN_PATH, SESSION_COOKIE, SET_PASSWORD_PATH } from "@/lib/auth/constants";
import { verifyTokenTag } from "@/lib/auth/invite-token";
import { limit } from "@/lib/cache/ratelimit";
import { log } from "@/lib/log";
import { buildCsp, generateNonce } from "@/lib/security/csp";
import { shouldBlockAdminByAllowlist } from "@/lib/security/allowlist";
import { clientIp, UNKNOWN_IP } from "@/lib/security/ip";
import { isAllowedOrigin } from "@/lib/security/origin";
import { isScannerPath } from "@/lib/security/scanner-paths";
import { getKvSetting } from "@/lib/settings/service";
import type { IpAllowlist, Maintenance } from "@/lib/settings/schema";

// Optimistic checks only: the proxy reads cookies and never the database. The
// data access layer (lib/auth/dal.ts) is the authority. Responsibilities 1, 2, 3, 4, 5
// and 6 of docs/plan/admin-cms-adr.md, section 4.5.

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const isAdminPage = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");
const isAdminApi = (pathname: string) => pathname === "/api/admin" || pathname.startsWith("/api/admin/");
const isCron = (pathname: string) => pathname === "/api/cron" || pathname.startsWith("/api/cron/");
const isApi = (pathname: string) => pathname === "/api" || pathname.startsWith("/api/");

/** Same 404 as any unknown URL: the rewrite target matches no route. */
function locked(request: NextRequest): NextResponse {
  const response = NextResponse.rewrite(new URL(LOCKED_PATH, request.url));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function extraOrigins(): string[] {
  return (process.env.ADMIN_ALLOWED_ORIGINS ?? "")
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function sessionToken(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  try {
    return await getToken({ req: request, secret, cookieName: SESSION_COOKIE, salt: SESSION_COOKIE });
  } catch {
    return null;
  }
}

/**
 * Check if maintenance mode is active for public paths.
 * Reads from KV cache first, falls back to safe default (NOT in maintenance).
 */
async function isMaintenanceActive(): Promise<boolean> {
  try {
    const setting = await getKvSetting("maintenance");
    if (setting && typeof setting === "object" && "enabled" in setting) {
      return Boolean((setting as Maintenance).enabled);
    }
  } catch {
    // Fall back to safe default if KV read fails
  }
  return false;
}

/**
 * Get the IP allowlist from KV cache.
 * Fails safe: if read fails, returns empty list (fail-open).
 */
async function getIpAllowlist(): Promise<string[]> {
  try {
    const setting = await getKvSetting("security.ipAllowlist");
    if (setting && typeof setting === "object" && "ips" in setting) {
      const list = (setting as IpAllowlist).ips;
      if (Array.isArray(list)) return list;
    }
  } catch {
    // Fall back to fail-open
  }
  return [];
}

/**
 * Serve a maintenance page (503 Service Unavailable).
 * Public response indicates the service is temporarily down.
 */
function maintenancePage(): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Maintenance</title>
  <style>body{font-family:sans-serif;text-align:center;padding:2rem}h1{font-size:2rem}p{color:#666}</style>
</head>
<body>
  <h1>Maintenance in Progress</h1>
  <p>The site is temporarily unavailable. Please try again later.</p>
</body>
</html>`,
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": "3600",
        "X-Robots-Tag": "noindex, nofollow, nocache",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}

/** Nonce CSP for one admin request; Next reads the nonce from the request header. */
function withCsp(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV !== "production" });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Scanner paths get a bare 404.
  if (isScannerPath(pathname)) return new NextResponse(null, { status: 404 });

  const adminPage = isAdminPage(pathname);
  const adminApi = isAdminApi(pathname);
  const cronPath = isCron(pathname);

  const now = Date.now();
  const bypassKeys = bypassKeysFromEnv();
  const bypassCookie = request.cookies.get(BYPASS_COOKIE)?.value;
  const hasBypassCookie = bypassKeys ? verifyBypassCookie(bypassCookie, now, bypassKeys) : false;

  // 2. Maintenance mode for public paths. isMaintenanceExempt (pure, unit
  // tested in lib/admin/maintenance-bypass.test.ts) is the single source of
  // truth for the exemption rule: admin pages, admin API, cron, and a valid
  // bypass cookie. Called here with hasBypassCookie=false, it reduces to the
  // path-only check that decides whether to enter this block at all.
  if (!isMaintenanceExempt(pathname, false)) {
    const maintenance = await isMaintenanceActive();
    if (maintenance && !isMaintenanceExempt(pathname, hasBypassCookie)) {
      return maintenancePage();
    }

    // 2a. Bypass query for maintenance: ?bypass-secret=...
    if (maintenance && searchParams.has(BYPASS_QUERY) && bypassKeys) {
      const ip = clientIp(request.headers);
      const attempt = await limit("maintenance:ip", ip);
      const accepted = attempt.ok && isValidBypassSecret(searchParams.get(BYPASS_QUERY), bypassKeys);
      if (!accepted) {
        log.warn("maintenance bypass refused", { ip, limited: !attempt.ok });
        return maintenancePage();
      }
      const clean = request.nextUrl.clone();
      clean.searchParams.delete(BYPASS_QUERY);
      const response = NextResponse.redirect(clean, 307);
      response.cookies.set(
        BYPASS_COOKIE,
        signBypassCookie(now, bypassKeys),
        bypassCookieOptions(process.env.NODE_ENV === "production")
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    // Public pages continue normally
    return NextResponse.next();
  }

  // 3. Origin check for unsafe methods on /admin and /api (not cron).
  if (UNSAFE_METHODS.has(request.method) && (adminPage || (isAdminApi(pathname) || (isApi(pathname) && !cronPath)))) {
    const allowed = isAllowedOrigin(request.headers.get("origin"), {
      hosts: [request.headers.get("host"), request.headers.get("x-forwarded-host")],
      siteUrl: process.env.SITE_URL,
      extraOrigins: extraOrigins(),
    });
    if (!allowed) {
      // The admin surface never answers 403, so it cannot be told from a missing page.
      return adminPage || adminApi ? locked(request) : new NextResponse(null, { status: 403 });
    }
  }

  if (!adminPage && !adminApi) return NextResponse.next();

  // 5. IP allowlist for /admin and /api/admin.
  // Fail-open when the list is empty (nothing configured) and also when the
  // caller's IP cannot be determined (R22: without TRUSTED_PROXY_HOPS, or off
  // Vercel, every caller reads as "unknown"). An allowlist that fail-closed on
  // an unknown IP would lock out every visitor, including the owner, the
  // moment it is turned on outside a trusted-proxy deployment; failing open in
  // that one case keeps the allowlist a real filter for identified callers
  // while never turning into a silent full lockout. This is logged loudly so
  // the gap is visible in production logs, and documented in the settings UI.
  if (adminPage || adminApi) {
    const allowlist = await getIpAllowlist();
    if (allowlist.length > 0) {
      const ip = clientIp(request.headers);
      if (ip === UNKNOWN_IP) {
        log.warn("admin IP allowlist is on but the client IP is unknown (set TRUSTED_PROXY_HOPS); allowing through");
      } else if (shouldBlockAdminByAllowlist(ip, allowlist)) {
        log.warn("admin access blocked by IP allowlist", { ip });
        return locked(request);
      }
    }
  }

  const keys = unlockKeysFromEnv();

  // 4a. Unlock query: /admin or /admin/login with ?secret=...
  if (adminPage && searchParams.has(UNLOCK_QUERY) && (pathname === "/admin" || pathname === LOGIN_PATH)) {
    const ip = clientIp(request.headers);
    const attempt = await limit("unlock:ip", ip);
    const accepted = attempt.ok && keys !== null && isUnlockSecret(searchParams.get(UNLOCK_QUERY), keys);
    if (!accepted || !keys) {
      log.warn("admin unlock refused", { ip, limited: !attempt.ok, configured: keys !== null });
      return locked(request);
    }
    const clean = request.nextUrl.clone();
    clean.searchParams.delete(UNLOCK_QUERY);
    const response = NextResponse.redirect(clean, 307);
    response.cookies.set(
      UNLOCK_COOKIE,
      signUnlockCookie(now, keys),
      unlockCookieOptions(process.env.NODE_ENV === "production")
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // 4b. An invite or reset link carries an HMAC tag only this server can make, so a
  // link that verifies reaches the set-password page without the unlock cookie. The
  // page and the action still check the token in the database (single use, expiry).
  if (adminPage && pathname === SET_PASSWORD_PATH && verifyTokenTag(searchParams.get("token"), process.env.AUTH_SECRET)) {
    return withCsp(request);
  }

  // 4c. Optimistic session check: signature and expiry only.
  const token = await sessionToken(request);
  const signedIn = Boolean(token?.sid);

  if (adminApi) return signedIn ? withCsp(request) : locked(request);

  const unlocked = keys ? verifyUnlockCookie(request.cookies.get(UNLOCK_COOKIE)?.value, now, keys) : false;
  if (!signedIn && !unlocked) return locked(request);

  if (!signedIn && pathname !== LOGIN_PATH) {
    const login = request.nextUrl.clone();
    login.pathname = LOGIN_PATH;
    login.search = "";
    login.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(login, 307);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // 6. Headers for an allowed admin request.
  return withCsp(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|map|woff2?|ttf|otf|mp3|mp4|webm)$).*)",
  ],
};
