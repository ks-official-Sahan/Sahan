---
"@sahan-sac/auth-kit": minor
---

Add a built-in SUPER_ADMIN role and opt-in masking of the super role.

- `defineAuthKit({ fixedGrants })`: roles whose permissions are fixed in code, like the super role. Stored rows and matrix edits never change them, and `isFixedRole` tells them apart.
- `SUPER_ADMIN_ROLE` (`./rbac/roles`): the built-in rank 5 row, managed and assigned only by the super role.
- `./rbac/mask`: `createMask` shows super-role accounts to other viewers as another role, globally or per account. Presentation only: authorization keeps the real role.
- `AuditEvent.actor.role` and the `audit_logs.actorRole` column snapshot the actor's role. `users.masked` stores the per-account mask. `upgrade.sql` adds both columns and fills `actorRole` on older rows from the actor's current role. Run `npx auth-kit db upgrade --apply`.
