# @sahan-sac/auth-kit-client

Renamed from `@sahan-sac/auth-kit-expo`; the entries below were published under that name.

## 0.1.0

### Minor Changes

- 2f74f93: First release: `createAuthKitClient` (a Better Auth React client typed with auth-kit's `role` and `mustChangePassword` fields; pass `expoClient(...)` from `@better-auth/expo/client`), `usePermission`, `permissionCheck` over auth-kit's RBAC rules, and `createApiFetch`, which calls your API with the stored session and app origin and refuses other hosts.
