// Pure permission checks over the signed-in user. The server stays the
// authority; these only decide what the app shows.

export interface KitUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  mustChangePassword?: boolean | null;
}

/** The user's role, or `fallback` when the session carries none. */
export function roleOf(user: Pick<KitUser, "role"> | null | undefined, fallback = "EDITOR"): string {
  return user?.role ?? fallback;
}

/**
 * Builds a check from auth-kit's RBAC rules, for apps that ship their role
 * matrix to the client:
 *
 *   import { can } from "@sahan-sac/auth-kit/rbac/rules";
 *   const allowed = permissionCheck((role, p) => can(kit, matrix, role, p));
 *   allowed(user, "posts.write");
 */
export function permissionCheck<TPermission extends string>(canRole: (role: string, permission: TPermission) => boolean, fallbackRole?: string) {
  return (user: Pick<KitUser, "role"> | null | undefined, permission: TPermission): boolean =>
    Boolean(user) && canRole(roleOf(user, fallbackRole), permission);
}
