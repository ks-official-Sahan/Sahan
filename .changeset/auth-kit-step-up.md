---
"@sahan-sac/auth-kit": minor
---

Step-up codes: the `STEP_UP` MFA purpose confirms one sensitive action, and `signStepUp`/`readStepUp` (`./mfa`) bind an emailed code to that action and user with a signed ticket. `renderMfaCode` now receives the `purpose`, so the code email can say what it is for. `upgrade.sql` adds the enum value, and `auth-kit doctor` also checks `users.masked`, `audit_logs.actorRole` and `STEP_UP`. Run `npx auth-kit db upgrade --apply`.
