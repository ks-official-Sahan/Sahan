---
"@sahan-sac/auth-kit": minor
---

Passkeys on several domains. `createPasskeys` takes `rpID` as one domain or a list (primary first). `registrationOptions`, `authenticationOptions` and `passwordlessOptions` take an optional `{ rpID }` naming the domain the ceremony runs on; an unlisted or missing name falls back to the first, so a request can never pick an arbitrary domain. Verification accepts a response bound to any listed domain. WebAuthn ties each passkey to the domain it was created on, so a backup domain needs its own passkeys; this lets the same account keep working there when the primary domain is down. A single `rpID` string behaves exactly as before.
