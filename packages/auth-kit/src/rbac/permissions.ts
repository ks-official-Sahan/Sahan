// Generic RBAC primitives. The actual catalogue — the list of roles, the list
// of permissions, per-role default grants, which permissions only the super
// role may hold — is app policy, defined once with `defineAuthKit` (see
// ../kit.ts) and not shipped here. `RoleName`/`Permission` stay plain opaque
// strings at this loose level so the rest of the package (adapter, session,
// credentials, config) can reference "a role" / "a permission" generically,
// without depending on any one app's catalogue; the functions below recover
// real type safety by taking the app's resolved config as their first
// argument and are generic over the app's own `TRole`/`TPermission` unions.
// No server-only import: nav and seeds read this file.

import type { RoleName } from "../adapter";
import type { ResolvedAuthKit } from "../kit";

// Re-exported from ../adapter (the single source of this alias) rather than
// declared again here, so a root-level `export *` of both `./adapter` and
// `./rbac` resolves to the same binding instead of an ambiguous duplicate.
export type { RoleName };
/** Opaque permission identifier. See `RoleName`. */
export type Permission = string;

type RbacCatalogue<TRole extends string, TPermission extends string> = Pick<
  ResolvedAuthKit<TRole, TPermission>,
  "roles" | "permissions" | "superRole" | "neverGrantable" | "defaultGrants"
> & { fixedGrants?: ResolvedAuthKit<TRole, TPermission>["fixedGrants"] };

export function isPermission<TRole extends string, TPermission extends string>(
  kit: Pick<RbacCatalogue<TRole, TPermission>, "permissions">,
  value: string
): value is TPermission {
  return (kit.permissions as readonly string[]).includes(value);
}

export function isRole<TRole extends string, TPermission extends string>(
  kit: Pick<RbacCatalogue<TRole, TPermission>, "roles">,
  value: string
): value is TRole {
  return (kit.roles as readonly string[]).includes(value);
}

/** True for a role whose permissions are fixed in code: the super role, or a role in `fixedGrants`. */
export function isFixedRole<TRole extends string, TPermission extends string>(
  kit: Pick<RbacCatalogue<TRole, TPermission>, "superRole" | "fixedGrants">,
  role: TRole
): boolean {
  return role === kit.superRole || kit.fixedGrants?.[role] !== undefined;
}

/**
 * The super role defaults to every permission and a `fixedGrants` role to its
 * fixed list, both in code; every other role's defaults come from
 * `defaultGrants`, minus anything it can never hold.
 */
export function defaultPermissionsFor<TRole extends string, TPermission extends string>(
  kit: Pick<RbacCatalogue<TRole, TPermission>, "superRole" | "permissions" | "defaultGrants" | "neverGrantable" | "fixedGrants">,
  role: TRole
): TPermission[] {
  if (role === kit.superRole) return [...kit.permissions];
  const fixed = kit.fixedGrants?.[role];
  if (fixed) return [...fixed];
  return (kit.defaultGrants[role] ?? []).filter((permission) => canBeGranted(kit, role, permission));
}

/** True when the role may hold this permission: a fixed role only what its code list says, any other role never a `neverGrantable` one. */
export function canBeGranted<TRole extends string, TPermission extends string>(
  kit: Pick<RbacCatalogue<TRole, TPermission>, "superRole" | "neverGrantable" | "fixedGrants">,
  role: TRole,
  permission: TPermission
): boolean {
  if (role === kit.superRole) return true;
  const fixed = kit.fixedGrants?.[role];
  if (fixed) return fixed.includes(permission);
  return !kit.neverGrantable.includes(permission);
}
