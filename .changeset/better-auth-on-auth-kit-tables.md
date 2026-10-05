---
"@sahan-sac/auth-kit": minor
---

Better Auth can now run on auth-kit's own tables, so an app on the next-auth engine can switch engines without moving data.

- `authKitSessions()` (in `./better-auth`) adds `POST /auth-kit/sign-in` and `POST /auth-kit/clear-session`. Sign-in runs auth-kit's `authorize` (lockout, IP limit, emailed MFA codes, known-device email, audit), and Better Auth writes the `user_sessions` row and the session cookie.
- `authKitDatabaseOptions("prisma" | "drizzle")` maps Better Auth onto `users` and `user_sessions`, with 24-hour sessions that are never extended. `AUTH_KIT_DISABLED_PATHS` switches off every Better Auth route that would sidestep auth-kit.
- `betterAuthSessionSource()` feeds `createAuthDal`, and `signInRefusal()` reads the sign-in refusal code.
- `createAuthDal` and `evaluateSession` accept `checkPasswordFingerprint: false`, for sessions without a `pwf` claim.
- `createAuthorize`'s `authorize` takes an optional third argument, `{ createSession }`.
- Schema: `users.emailVerified`, plus `user_sessions.token` (nullable, unique) and `updatedAt`, in `prisma/auth.prisma` and `createAuthSchema`. These are additive columns with defaults, so apps that copy the schema need a migration that adds them.
