---
"@sahan-sac/auth-kit": minor
---

Runtime roles. Roles are rows in a new `roles` table (`name`, `label`, `description`, `rank`, `system`) instead of the Postgres enum `Role`, so an admin can add roles without a deploy; `users.role`, `role_permissions.role` and `auth_tokens.role` are text with foreign keys to it (restrict, cascade and set null on delete). `createAuthSchema` returns `roles` instead of `roleEnum`, and its `roles` option only types the columns now. `createRbac` takes `loadRoles` so the matrix covers stored roles, and a role the matrix does not know holds nothing. New `./rbac/roles`: `createRoleCatalog` (rank hierarchy: `canManage`, `assignable`) and `checkRoleInput`. **Upgrade:** run `npx auth-kit db upgrade --apply` (or `@sahan-sac/auth-kit/prisma/upgrade.sql`) once before deploying; it converts the enum in place, keeps every row, and is safe to rerun.
