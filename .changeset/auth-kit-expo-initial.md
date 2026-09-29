---
"@sahan-sac/auth-kit-expo": minor
---

First release: `createAuthKitClient` (a Better Auth React client typed with auth-kit's `role` and `mustChangePassword` fields; pass `expoClient(...)` from `@better-auth/expo/client`), `usePermission`, `permissionCheck` over auth-kit's RBAC rules, and `createApiFetch`, which calls your API with the stored session and app origin and refuses other hosts.
