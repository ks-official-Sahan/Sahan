import { resolveCookieName } from "./constants";

import type { LimitRule } from "./cache/ratelimit";

// The single config surface every generic piece of this package (RBAC, cookie
// naming, rate limit buckets, CSP hosts, proxy trust) is parameterized over.
// Everything here is app policy: cookie names, paths, the Redis key prefix,
// the role/permission catalogue, rate limit buckets and CSP hosts are yours,
// not this package's. Call `defineAuthKit` once (see the README's
// "defineAuthKit config" step; the app in this repo does it in
// `lib/auth/kit.ts`) and thread the result into `createAuthConfig`,
// `createRbac`, `createSessionStore`, `createMfa` and the proxy.
//
// Framework-agnostic on purpose (no Next.js or next-auth import): safe to
// import from a client component or a plain test runner.

export interface AuthKitPaths {
  /** Where the sign-in form lives, and where `pages.signIn`/`pages.error` point. */
  login: string;
  /** A path that matches no route, so rewriting to it renders the app's real public 404. */
  locked: string;
  /** Route Handler that clears the session cookie of a revoked/expired/disabled browser. */
  expire: string;
  /** Where a user with `mustChangePassword` is sent until they choose their own password. */
  accountPasswordChange: string;
  /** Invite and reset links land here. */
  setPassword: string;
  /** Self-service "forgot password" request form. */
  forgotPassword: string;
  /** Email-change confirmation links land here. */
  confirmEmail: string;
  /** Where a successful sign-in goes without a `callbackUrl`. */
  defaultCallback: string;
}

export interface AuthKitCookies {
  /** Base name of the Auth.js session cookie, e.g. `"myapp_admin_session"`. Resolve with `sessionCookieName` for the `__Host-`-prefixed production form. */
  session: string;
  /** Base name of the hidden-login unlock cookie. Resolve with `unlockCookieName`. */
  unlock: string;
}

export interface AuthKitCsp {
  /** Extra `img-src` hosts, e.g. an image CDN. */
  imgHosts: readonly string[];
  /** Extra `connect-src` hosts, e.g. an upload API. */
  connectHosts: readonly string[];
  /** See `CspOptions.allowInlineStyles` in `./security/csp`. Defaults to `true`. */
  allowInlineStyles: boolean;
}

export interface AuthKitTrustProxy {
  /** Trust Vercel's own IP headers. Defaults to auto-detecting `process.env.VERCEL`. */
  vercel: boolean;
  /** How many of your own reverse proxies append to `x-forwarded-for`. 0 means none are trusted. */
  hops: number;
}

/**
 * An observability hook, defaulting to a no-op. Fires for events the app
 * cannot see from the outside (a rate limiter failing open, a session cache
 * miss, ...) so it can log or alert on them without this package taking a
 * logging dependency of its own. `type` is deliberately open-ended (new event
 * types may be added); treat unknown types as informational.
 */
export interface AuthKitEvent {
  type: "ratelimit.degraded" | "session.cache.miss" | "session.cache.down" | "auth.fail_open" | "bootstrap.raced" | (string & {});
  message?: string;
  [key: string]: unknown;
}

export interface Person<TRole extends string> {
  id: string;
  role: TRole;
}

export interface AuthKitConfig<TRole extends string, TPermission extends string> {
  cookies: AuthKitCookies;
  /** Any path left out falls back to a generic `/admin/...` default (see the README). */
  paths?: Partial<AuthKitPaths>;
  /** Namespaces every KV/Redis key this package's factories write. For example `"myapp:"`. */
  keyPrefix: string;
  roles: readonly TRole[];
  /** The role that always holds every permission, in code, so a bad matrix edit can never lock its own owner out. */
  superRole: TRole;
  permissions: readonly TPermission[];
  /** Permissions only `superRole` may ever hold, no matter what the stored matrix says. */
  neverGrantable?: readonly TPermission[];
  /** Seed defaults per role (excluding `superRole`, which always defaults to every permission). */
  defaultGrants: Partial<Record<TRole, readonly TPermission[]>>;
  /**
   * Who may manage whom (change role, disable, delete, reset password, ...).
   * Defaults to "only `superRole` manages anyone other than themself" — override
   * with your own hierarchy (e.g. a 3-tier "manager manages only the tier below").
   */
  canManage?: (actor: Person<TRole>, target: Person<TRole>) => boolean;
  /** Roles the actor may assign to someone else. Defaults to "superRole assigns any role, everyone else assigns none". */
  assignableRoles?: (actorRole: TRole) => readonly TRole[];
  /** The app's full rate-limit bucket catalogue (bucket name -> window/ceiling/fail mode). There is no default: bucket names are app policy. */
  limits: Record<string, LimitRule>;
  csp?: Partial<AuthKitCsp>;
  trustProxy?: Partial<AuthKitTrustProxy>;
  onEvent?: (event: AuthKitEvent) => void;
}

export interface ResolvedAuthKit<TRole extends string, TPermission extends string> {
  cookies: AuthKitCookies;
  paths: AuthKitPaths;
  keyPrefix: string;
  roles: readonly TRole[];
  superRole: TRole;
  permissions: readonly TPermission[];
  neverGrantable: readonly TPermission[];
  defaultGrants: Partial<Record<TRole, readonly TPermission[]>>;
  canManage: (actor: Person<TRole>, target: Person<TRole>) => boolean;
  assignableRoles: (actorRole: TRole) => readonly TRole[];
  limits: Record<string, LimitRule>;
  csp: AuthKitCsp;
  trustProxy: AuthKitTrustProxy;
  onEvent: (event: AuthKitEvent) => void;
  /** `cookies.session`, `__Host-`-prefixed in production (see `resolveCookieName`). */
  sessionCookieName(production: boolean): string;
  /** `cookies.unlock`, `__Host-`-prefixed in production. */
  unlockCookieName(production: boolean): string;
}

const DEFAULT_PATHS: AuthKitPaths = {
  login: "/admin/login",
  locked: "/not-found",
  expire: "/api/auth/expire",
  accountPasswordChange: "/admin/account",
  setPassword: "/admin/set-password",
  forgotPassword: "/admin/forgot-password",
  confirmEmail: "/admin/confirm-email",
  defaultCallback: "/admin",
};

export function defineAuthKit<TRole extends string, TPermission extends string>(
  config: AuthKitConfig<TRole, TPermission>
): ResolvedAuthKit<TRole, TPermission> {
  const { roles, superRole } = config;

  const canManage =
    config.canManage ?? ((actor: Person<TRole>, target: Person<TRole>) => actor.id !== target.id && actor.role === superRole);
  const assignableRoles = config.assignableRoles ?? ((actorRole: TRole) => (actorRole === superRole ? [...roles] : []));

  return {
    cookies: config.cookies,
    paths: { ...DEFAULT_PATHS, ...config.paths },
    keyPrefix: config.keyPrefix,
    roles,
    superRole,
    permissions: config.permissions,
    neverGrantable: config.neverGrantable ?? [],
    defaultGrants: config.defaultGrants,
    canManage,
    assignableRoles,
    limits: config.limits,
    csp: {
      imgHosts: config.csp?.imgHosts ?? [],
      connectHosts: config.csp?.connectHosts ?? [],
      allowInlineStyles: config.csp?.allowInlineStyles ?? true,
    },
    trustProxy: {
      vercel: config.trustProxy?.vercel ?? Boolean(process.env.VERCEL),
      hops: config.trustProxy?.hops ?? 0,
    },
    onEvent: config.onEvent ?? (() => {}),
    sessionCookieName: (production: boolean) => resolveCookieName(config.cookies.session, production),
    unlockCookieName: (production: boolean) => resolveCookieName(config.cookies.unlock, production),
  };
}
