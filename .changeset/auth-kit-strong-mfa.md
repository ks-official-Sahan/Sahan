---
"@sahan-sac/auth-kit": minor
---

Authenticator apps (TOTP), recovery codes and passkeys as second factors, and a strong-MFA gate for chosen roles.

- `./mfa`: `createMfa` adds `openTicket`, `verifyTotp`, `verifyRecoveryCode`, `verifyFactor`, `factorsOf`, `beginTotpSetup`, `confirmTotpSetup`, `removeTotp` and `issueRecoveryCodes`, with a required `claimOnce` dep (one TOTP code works once) and optional `factorSecret` and `setupLimit`. `audit` receives a transaction for factor changes: each change, its recovery codes and its audit row commit together, serialized per user. New pure helpers: `totp` (RFC 6238), `recovery`, `sealed` (AES-256-GCM) and `factors` (`mfaMethodsFor`, `mustSetUpStrongMfa`).
- `./webauthn` (new): `createPasskeys` registers discoverable passkeys, verifies a passkey against the sign-in ticket, and (with a `challengeStore`) supports passwordless sign-in through `passwordlessOptions` / `verifyPasswordless`, which require user verification and match the credential to its user handle. `@simplewebauthn/server` is an optional peer dependency, only needed by projects that import this subpath.
- `mfaMethodsFor(factors)` offers every method the user set up, the emailed code included, the same for every role; `createMfa` adds `openVerifiedTicket` for a factor that proved both steps (a passwordless passkey) and `removeFactors(actor, { userId, ... })` for an administrator resetting another user's app, passkeys or recovery codes; it reports what was actually removed.
- `authorize`: a user with a confirmed authenticator app or a passkey now needs the second step too (`mfa_required`).
- `defineAuthKit`: `strongMfaRoles` (default none) and `paths.mfaSetup`. `createAuthDal` takes `strongMfaRoles` and `mfaSetupPath`, sets `AuthUser.mfaSetupRequired`, and sends such users to the setup page unless `requireUser({ allowMfaSetup: true })`.
- `AuthDbAdapter`: new factor methods (`findMfaFactors`, `lockUser`, `setTotpSecret`, `beginTotpSecret`, `confirmTotpSecret`, `replaceRecoveryCodes`, `consumeRecoveryCode`, `listPasskeys`, `findPasskey`, `createPasskey`, `updatePasskeyUse`, `deletePasskey`, `deletePasskeys`), and `findUserForAuth` and `findSessionWithUser` return `strongMfa`. The Prisma and Drizzle adapters implement them; a custom adapter must add them.
- Schema: `users.totpSecretCipher`, `users.totpEnabledAt`, `mfa_recovery_codes`, `webauthn_credentials`, and the `PASSKEY_REGISTER` / `PASSKEY_SIGN_IN` purposes. Additive only; run `prisma/upgrade.sql` (step 6) or `npx auth-kit db upgrade --apply`, then `prisma generate`.
