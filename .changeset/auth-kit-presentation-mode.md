---
"@sahan-sac/auth-kit": minor
---

`./rbac/mask`: `createMask` is off unless its policy sets `enabled: true`. Resolve it with `presentationModeOn(process.env.ADMIN_PRESENTATION_MODE)`, which is true only for the exact value `"true"`. While off, roles, role rows, counts and audit visibility are unchanged, and stored state is ignored. Adds `hiddenAuditRole`, `NO_MASKS` and an optional `state` argument.
