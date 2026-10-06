---
"@sahan-sac/auth-kit": minor
---

The root entry no longer loads an auth engine. `createAuthConfig`, `InvalidLogin`, `LimitedLogin` and `MfaLogin` are no longer exported from `@sahan-sac/auth-kit`; import them from `@sahan-sac/auth-kit/next-auth` instead. An app on Better Auth can now import the root without `next-auth` installed, and a test keeps every non-engine entry free of both engines.

A configured Redis that errors or times out no longer fails the request. `getKv()` wraps it in the new `FailoverKv`, which serves from memory for 30 seconds and then tries Redis again. `kvBackend()` reports `"upstash-degraded"` while that happens. `FailoverKv` and `withTimeout` are exported from `./cache/memory` for apps that build their own key-value store.
