import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import type { InvalidationPlan } from "./plan";

/**
 * Applies an invalidation plan. Call it from a Server Action or a Route
 * Handler only: revalidateTag and revalidatePath do not work in Client
 * Components or the proxy.
 *
 * Tags use the "max" profile (stale-while-revalidate): the old page keeps being
 * served while the new one builds, so a database blip during regeneration never
 * blanks the public site. `{ expire: 0 }` is deliberately not used for public
 * tags (docs/plan/admin-cms-adr.md, section 5.1 and R16).
 */
export function invalidate(plan: InvalidationPlan): void {
  for (const tag of new Set(plan.tags)) {
    revalidateTag(tag, "max");
  }
  for (const entry of plan.paths) {
    if (typeof entry === "string") revalidatePath(entry);
    else revalidatePath(entry.path, entry.type);
  }
}
