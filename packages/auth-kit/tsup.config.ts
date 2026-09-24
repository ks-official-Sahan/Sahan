import { defineConfig } from "tsup";

// One entry per package.json `exports` subpath, each emitted at the same
// relative path under dist/ (e.g. src/security/ip.ts -> dist/security/ip.js
// + dist/security/ip.d.ts) so publishConfig.exports's dist paths line up
// exactly. ESM only (the package is "type": "module" and every consumer is
// Next.js/Node ESM-capable); node: builtins and every peer dependency
// (next, next-auth, react) stay external, never bundled.
export default defineConfig({
  entry: [
    "src/index.ts",
    "src/kit.ts",
    "src/authorize.ts",
    "src/config.ts",
    "src/bootstrap.ts",
    "src/audit-event.ts",
    "src/session/index.ts",
    "src/rbac/index.ts",
    "src/mfa/index.ts",
    "src/security/index.ts",
    "src/cache/index.ts",
    "src/credentials.ts",
    "src/adapter.ts",
    "src/password.ts",
    "src/password-policy.ts",
    "src/invite-token.ts",
    "src/safe-callback-url.ts",
    "src/constants.ts",
    "src/login-unlock.ts",
    "src/unlock-request.ts",
    "src/security/ip.ts",
    "src/security/allowlist.ts",
    "src/security/origin.ts",
    "src/security/csp.ts",
    "src/security/headers.ts",
    "src/security/scanner-paths.ts",
    "src/security/check-origin.ts",
    "src/security/request-device.ts",
    "src/cache/ratelimit.ts",
    "src/cache/memory.ts",
    "src/cache/redis.ts",
  ],
  format: ["esm"],
  dts: { resolve: false },
  tsconfig: "tsconfig.build.json",
  outDir: "dist",
  splitting: false,
  sourcemap: false,
  clean: true,
  target: "es2022",
  platform: "node",
  external: ["next", "next-auth", "next-auth/providers/credentials", "next/server", "next/headers", "next/navigation", "react", "react-server-dom-webpack"],
  skipNodeModulesBundle: true,
});
