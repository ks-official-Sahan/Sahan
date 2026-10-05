---
"@sahan-sac/auth-kit": minor
---

Shorter auth links. `createToken` now makes 34-character invite and reset tokens (128 random bits and a 64-bit tag) instead of 66; `verifyTokenTag` accepts both forms, so links already sent keep working until they expire. New `signSignInLink`, `verifySignInLink` and `signInLinkDays` (with `SIGN_IN_LINK_DEFAULT_DAYS` and `SIGN_IN_LINK_MAX_DAYS`) make a short, expiring code that unlocks the hidden login page like `?secret=` does, without the secret in a URL. Rotating either secret ends every code. New `@sahan-sac/auth-kit/short-link` packages the short links themselves: `parseShortLink`, `accountLinkPath`/`emailLinkPath`/`signInLinkPath` (`/a/<token>`, `/e/<token>`, `/s/<code>[/<admin path>]`), `shortLinkTarget`, and `resolveShortLink`, a framework-agnostic decision (redirect, with or without the unlock cookie, or the ordinary 404) a proxy answers with no database read.
