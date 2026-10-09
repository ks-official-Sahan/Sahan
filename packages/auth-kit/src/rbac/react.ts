import { cache } from "react";

import { createRbac, type RbacDependencies } from "./rbac";

/** React server cache adapter; the base RBAC entry stays runtime-agnostic. */
export function createReactRbac<TRole extends string, TPermission extends string>(
  deps: Omit<RbacDependencies<TRole, TPermission>, "cache">
) {
  return createRbac({ ...deps, cache: cache as RbacDependencies<TRole, TPermission>["cache"] });
}
