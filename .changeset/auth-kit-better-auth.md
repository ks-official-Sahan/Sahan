---
"@sahan-sac/auth-kit": minor
---

New `./better-auth` engine: an `authKit()` Better Auth plugin that adds auth-kit's login-unlock gate, sign-in throttling, password policy, audit events and server-only `role`/`mustChangePassword` user fields; `authKitEmailPassword()` keeps auth-kit's bcrypt hashes and length limits so existing users sign in unchanged; `readBetterAuthSession()` returns the session in auth-kit's shape. `better-auth` is a new optional peer dependency; the next-auth engine is unchanged.
