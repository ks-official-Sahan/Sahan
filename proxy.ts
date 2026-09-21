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
import { LOCKED_PATH, LOGIN_PATH, SESSION_COOKIE } from "@/lib/auth/constants";
import { limit } from "@/lib/cache/ratelimit";
import { log } from "@/lib/log";
import { buildCsp, generateNonce } from "@/lib/security/csp";
import { clientIp } from "@/lib/security/ip";
import { isAllowedOrigin } from "@/lib/security/origin";
import { isScannerPath } from "@/lib/security/scanner-paths";

// Optimistic checks only: the proxy reads cookies and never the database. The
// data access layer (lib/auth/dal.ts) is the authority. Responsibilities 1, 3, 4
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

  // 3. Origin check for unsafe methods on /admin and /api (not cron).
  if (UNSAFE_METHODS.has(request.method) && (adminPage || (isApi(pathname) && !isCron(pathname)))) {
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

  const keys = unlockKeysFromEnv();
  const now = Date.now();

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

  // 4b. Optimistic session check: signature and expiry only.
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
