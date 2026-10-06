---
"@sahan-sac/auth-kit": minor
---

Add a built-in SUPER_ADMIN role and opt-in masking of the super role.

- `defineAuthKit({ deniedPermissions })`: a per-role cap. `canBeGranted`, `defaultPermissionsFor`, `matrixFromRows` and `validateMatrix` never let a capped role hold a denied permission, whatever the stored matrix says.
- `SUPER_ADMIN_ROLE` (`./rbac/roles`): the built-in rank 5 row, managed and assigned only by the super role.
- `./rbac/mask`: `createMask` shows super-role accounts to other viewers as another role, globally or per account. Presentation only: authorization keeps the real role.
- `AuditEvent.actor.role` and the `audit_logs.actorRole` column snapshot the actor's role. `users.masked` stores the per-account mask. `upgrade.sql` adds both columns and fills `actorRole` on older rows from the actor's current role. Run `npx auth-kit db upgrade --apply`.
