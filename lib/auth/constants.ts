// Names and paths shared by proxy.ts and lib/auth/config.ts. No secrets and no
// server-only import, because the proxy needs them too.
// Design record: docs/plan/admin-cms-adr.md, section 6.

/** Auth.js session cookie. Also the JWT salt, so getToken() in the proxy uses the same name. */
export const SESSION_COOKIE = "sahan_admin_session";

/** JWT lifetime. The UserSession row expires at the same moment and is the authority. */
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export const LOGIN_PATH = "/admin/login";

/** Matches no route, so a rewrite to it renders the public 404 with a real 404 status. */
export const LOCKED_PATH = "/not-found";

/** Route Handler that clears the session cookie of a revoked browser. */
export const EXPIRE_PATH = "/api/auth/expire";
