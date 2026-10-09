// Pure, runtime-agnostic root: safe to import from a client component or a
// plain test runner (no `next/headers`, `next/navigation` or `server-only`
// anywhere in this module's own import graph). Server/Next-only code lives at
// explicit subpaths instead — `./session` (next/navigation, next/server),
// `./security` (request-device uses next/headers), `./cache` (server-only),
// `./unlock-request` (next/headers) — see package.json's `exports` map and
// the README for the full list.
//
// No auth engine either: next-auth lives at `./next-auth` and Better Auth at
// `./better-auth`, so importing this root never resolves an engine the app
// did not install.
export * from "./adapter";
export * from "./audit-event";
export * from "./authorize";
export * from "./bootstrap";
export { resolveCookieName, SESSION_MAX_AGE_SECONDS } from "./constants";
export * from "./credentials";
export * from "./invite-token";
export * from "./login-unlock";
export * from "./password";
export * from "./password-policy";
export * from "./safe-callback-url";
export * from "./short-link";
export * from "./kit";

export * from "./mfa";
export * from "./rbac";

// Auth.js type augmentation is exposed at the explicit `./next-auth-types`
// subpath so npm consumers can opt into it without widening this root's peers.
