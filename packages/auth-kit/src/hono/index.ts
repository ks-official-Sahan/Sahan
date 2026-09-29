import type { Context, Handler, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";

import { SECURITY_HEADERS } from "../security/headers";
import { clientIp, type ClientIpOptions, UNKNOWN_IP } from "../security/ip";
import { isAllowedOrigin } from "../security/origin";

// auth-kit for Hono. The same rules the Next.js app applies in proxy.ts and
// its route handlers: static security headers, an Origin check on unsafe
// methods, rate limits, the session read once per request, and permission
// gates that answer 404 so a protected route cannot be told from a missing one.

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Adds auth-kit's static security headers to every response that has not set them. */
export function securityHeaders(): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    await next();
    for (const { key, value } of SECURITY_HEADERS) {
      if (!c.res.headers.has(key)) c.res.headers.set(key, value);
    }
  });
}

export interface OriginGuardOptions {
  /** Public site URL; its origin is always allowed. */
  siteUrl?: string | null;
  /** More allowed origins (parse an env list with parseOriginList from ./security/origin). */
  extraOrigins?: readonly string[];
  /**
   * Native app origins, like `"myapp://"`. Expo apps send no Origin; Better
   * Auth's Expo client sends `expo-origin` instead. A browser page cannot set
   * that header on a cross-site request without a CORS preflight, so an exact
   * match is safe to accept.
   */
  nativeOrigins?: readonly string[];
  /** Status for a refused request. Default 403; use 404 on admin-only apps. */
  status?: 403 | 404;
}

/**
 * CSRF layer: refuses POST/PUT/PATCH/DELETE whose Origin is missing or is
 * neither this host nor an allowed origin. Mount it before any route that
 * changes state. List native app schemes in `nativeOrigins`.
 */
export function originGuard(options: OriginGuardOptions = {}): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();
    const origin = c.req.header("origin");
    const nativeOrigin = origin ? undefined : c.req.header("expo-origin");
    if (nativeOrigin && options.nativeOrigins?.includes(nativeOrigin)) return next();
    const allowed = isAllowedOrigin(origin, {
      hosts: [c.req.header("host"), c.req.header("x-forwarded-host")],
      siteUrl: options.siteUrl,
      extraOrigins: options.extraOrigins ?? [],
    });
    if (!allowed) return c.body(null, options.status ?? 403);
    return next();
  });
}

export interface RateLimitOptions {
  /** One attempt for this key. Wire createRateLimit's `limit(bucket, key)` from ./cache/ratelimit. */
  limit: (key: string) => Promise<{ ok: boolean; resetSeconds?: number }>;
  /** Key per request. Default: the client IP (see ./security/ip), or "unknown". */
  key?: (c: Context) => string | Promise<string>;
  /** Which proxy headers to believe for the default IP key. */
  clientIp?: ClientIpOptions;
}

/** Answers 429 with Retry-After when the caller's bucket is spent. */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    const key = options.key ? await options.key(c) : clientIp(c.req.raw.headers, options.clientIp) || UNKNOWN_IP;
    const result = await options.limit(key);
    if (!result.ok) {
      if (result.resetSeconds) c.header("Retry-After", String(Math.max(1, Math.ceil(result.resetSeconds))));
      return c.json({ error: "Too many requests." }, 429);
    }
    return next();
  });
}

/** Hono context variables set by `session()`. */
export interface SessionVariables<TSession> {
  session: TSession | null;
}

/**
 * Reads the session once per request and stores it as `c.get("session")`
 * (null when signed out). With the Better Auth engine pass
 * `(headers) => readBetterAuthSession(auth, headers)`.
 */
export function session<TSession>(read: (headers: Headers) => Promise<TSession | null>) {
  return createMiddleware<{ Variables: SessionVariables<TSession> }>(async (c, next) => {
    c.set("session", await read(c.req.raw.headers));
    return next();
  });
}

/**
 * Lets the request through only when there is a session and `allow(session)`
 * is true; otherwise 404 (never 401 or 403). Mount after `session()`. With
 * auth-kit's RBAC: `requirePermission((s) => rbac.can(s.role, "posts.write"))`.
 */
export function requirePermission<TSession>(allow: (session: TSession) => boolean | Promise<boolean> = () => true) {
  return createMiddleware<{ Variables: SessionVariables<TSession> }>(async (c, next) => {
    const current = c.get("session");
    if (!current || !(await allow(current))) return c.notFound();
    return next();
  });
}

/** Mounts a Better Auth instance: `app.on(["GET", "POST"], "/api/auth/*", betterAuthRoute(auth))`. */
export function betterAuthRoute(auth: { handler(request: Request): Promise<Response> }): Handler {
  return (c) => auth.handler(c.req.raw);
}
