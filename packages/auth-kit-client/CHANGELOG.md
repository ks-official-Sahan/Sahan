# @sahan-sac/auth-kit-client

Renamed from `@sahan-sac/auth-kit-expo`; the entries below were published under that name.

## 0.1.0

### Minor Changes

- 6888284: `@sahan-sac/auth-kit-expo` is now `@sahan-sac/auth-kit-client`, for React web as well as React Native. `createAuthKitClient` adds `authClient.authKit.signIn({ email, password } | { challengeId })`, which answers `{ ok: true }` or auth-kit's refusal code, and `authClient.authKit.signOut()`, which also revokes the session row. `createApiFetch` works in a browser when `getCookie` is left out (the browser sends the cookie). `parseAuthLink(url, siteUrl)` recognises auth-kit short links (`/a/`, `/e/`, `/s/`) arriving as universal links. auth-kit is bundled in, never a runtime dependency.

## 0.1.0

### Minor Changes

- 2f74f93: First release: `createAuthKitClient` (a Better Auth React client typed with auth-kit's `role` and `mustChangePassword` fields; pass `expoClient(...)` from `@better-auth/expo/client`), `usePermission`, `permissionCheck` over auth-kit's RBAC rules, and `createApiFetch`, which calls your API with the stored session and app origin and refuses other hosts.
