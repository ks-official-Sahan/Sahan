import type { KitUser } from "./permissions";

/** The part of a Better Auth React client the hooks use. */
export interface SessionHookClient<TUser extends KitUser> {
  useSession(): { data: { user: TUser } | null; isPending: boolean };
}

export interface PermissionState<TUser> {
  /** False while loading, when signed out, or when `allow` says no. */
  allowed: boolean;
  isPending: boolean;
  user: TUser | null;
}

/**
 * Whether the signed-in user passes `allow`, for showing or hiding screens:
 *
 *   const { allowed, isPending } = usePermission(authClient, (u) => u.role === "DEVELOPER");
 */
export function usePermission<TUser extends KitUser>(client: SessionHookClient<TUser>, allow: (user: TUser) => boolean = () => true): PermissionState<TUser> {
  const { data, isPending } = client.useSession();
  const user = data?.user ?? null;
  return { allowed: user !== null && !isPending && allow(user), isPending, user };
}
