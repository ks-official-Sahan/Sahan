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
>;

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

/** The super role defaults to every permission in code; every other role's defaults come from `defaultGrants`. */
export function defaultPermissionsFor<TRole extends string, TPermission extends string>(
  kit: Pick<RbacCatalogue<TRole, TPermission>, "superRole" | "permissions" | "defaultGrants">,
  role: TRole
): TPermission[] {
  if (role === kit.superRole) return [...kit.permissions];
  return [...(kit.defaultGrants[role] ?? [])];
}

/** True when the matrix may store this permission for the role. */
export function canBeGranted<TRole extends string, TPermission extends string>(
  kit: Pick<RbacCatalogue<TRole, TPermission>, "superRole" | "neverGrantable">,
  role: TRole,
  permission: TPermission
): boolean {
  if (role === kit.superRole) return true;
  return !kit.neverGrantable.includes(permission);
}
