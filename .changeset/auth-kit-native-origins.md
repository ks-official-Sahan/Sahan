---
"@sahan-sac/auth-kit": minor
---

`originGuard` (`./hono`) accepts `nativeOrigins` (for example `"myapp://"`): a request without a browser Origin passes when its `expo-origin` header matches exactly. New `./rbac/rules` subpath exposes the pure RBAC rules (`can`, `defaultMatrix`, ...) without React, for React Native clients.
