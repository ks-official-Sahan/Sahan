// Pure, runtime-agnostic root: safe to import from a client component or a
// plain test runner (no `next/headers`, `next/navigation` or `server-only`
// anywhere in this module's own import graph). Server/Next-only code lives at
// explicit subpaths instead — `./session` (next/navigation, next/server),
// `./security` (request-device uses next/headers), `./cache` (server-only),
// `./unlock-request` (next/headers) — see package.json's `exports` map and
// the README for the full list.
//
// `./config` and `./credentials` are kept here even though `createAuthConfig`
// depends on `next-auth`/`next/server` at the type/runtime level: they are
// the one required piece of Next.js wiring every consumer needs regardless of
// entry point, and neither has the hard "throws if bundled into a Client
// Component" behavior `next/headers` has.
export * from "./adapter";
export * from "./audit-event";
export * from "./authorize";
export * from "./bootstrap";
export * from "./config";
export { resolveCookieName, SESSION_MAX_AGE_SECONDS } from "./constants";
export * from "./credentials";
export * from "./invite-token";
export * from "./login-unlock";
export * from "./password";
export * from "./password-policy";
export * from "./safe-callback-url";
export * from "./kit";

export * from "./mfa";
export * from "./rbac";

// Note on next-auth.d.ts: it augments `next-auth`'s `Session`/`User` and
// `@auth/core/jwt`'s `JWT` ambiently (`declare module`), and is deliberately
// NOT imported from here — a `.d.ts` file has no runtime module to import,
// so a side-effect `import "./next-auth"` would compile but fail to resolve
// at actual runtime. Instead it just needs to be part of a consuming
// project's TypeScript `include` (a workspace consumer that globs
// `packages/*/src/**/*.ts`, as this repo's app does, already gets it for
// free); see the README's "TypeScript augmentation" note for the published
// package.
