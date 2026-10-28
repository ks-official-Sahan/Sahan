---
"@sahan-sac/email-kit": minor
---

Generic SMTP provider (`./providers/smtp`): any relay, optional AUTH, TLS required in production, plain allowed elsewhere (local Mailpit). `SmtpConfig.user` and `pass` are now optional. `renderEmail` takes an optional `theme` (`accent`, `canvas`, https `logoUrl`) for per-send brand tokens; invalid values fall back to the neutral layout. No change when the new options are unset.
