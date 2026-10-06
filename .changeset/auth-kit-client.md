---
"@sahan-sac/auth-kit-client": minor
---

`@sahan-sac/auth-kit-expo` is now `@sahan-sac/auth-kit-client`, for React web as well as React Native. `createAuthKitClient` adds `authClient.authKit.signIn({ email, password } | { challengeId })`, which answers `{ ok: true }` or auth-kit's refusal code, and `authClient.authKit.signOut()`, which also revokes the session row. `createApiFetch` works in a browser when `getCookie` is left out (the browser sends the cookie). `parseAuthLink(url, siteUrl)` recognises auth-kit short links (`/a/`, `/e/`, `/s/`) arriving as universal links. auth-kit is bundled in, never a runtime dependency.
