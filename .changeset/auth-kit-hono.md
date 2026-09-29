---
"@sahan-sac/auth-kit": minor
---

New `./hono` subpath: `securityHeaders`, `originGuard` (CSRF check on unsafe methods), `rateLimit` (429 with Retry-After), `session` (read once per request), `requirePermission` (404 when signed out or not allowed) and `betterAuthRoute` for mounting Better Auth. `hono` is a new optional peer dependency.
