---
"@sahan-sac/auth-kit": minor
---

Framework-neutral core, first step toward the Better Auth, Hono and Expo engines. User agents are parsed by the new `./user-agent` (ua-parser-js 1.x, the same parser Next.js bundles) instead of `next/server`, so `authorize` and the session store no longer import Next.js. New subpaths: `./next-auth` (engine-named alias of `./config`), `./session/core` (session state and store without React), `./security/device` (`requestDetailsFromHeaders` for any `Headers`). `next`, `next-auth` and `react` are now optional peer dependencies. Existing imports keep working unchanged.
