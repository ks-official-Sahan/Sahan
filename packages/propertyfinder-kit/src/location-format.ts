// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers for Property Finder location formatting.
//
// Kept in a standalone module (no Next.js cache or server-only imports) so the CLI
// diagnostic script at `scripts/location-check.ts` can reuse the exact same
// formatter as the Next.js runtime.
// ─────────────────────────────────────────────────────────────────────────────

import type { AppPropertyLocation, PFLocation } from "./types";

/**
 * Build a hierarchical address string, most-specific first.
 *   tree = [{ Dubai }, { Dubai Land }, { Majan }, { Taormina Village }]
 *   self = "Taormina Village"
 *   →     "Taormina Village, Majan, Dubai Land, Dubai."
 *
 * The last tree node is typically the location itself; consecutive duplicates
 * are collapsed so we don't emit "Taormina Village, Taormina Village, …".
 */
export function formatFullAddress(
  tree: PFLocation["tree"],
  self: string,
): string {
  const ordered =
    tree && tree.length > 0 ? [...tree].reverse().map((n) => n.name) : [self];
  const withSelf = ordered[0] === self ? ordered : [self, ...ordered];
  const deduped = withSelf.filter((name, i, arr) => name && name !== arr[i - 1]);
  return `${deduped.join(", ")}.`;
}

export function toAppLocation(loc: PFLocation): AppPropertyLocation {
  return {
    id: loc.id,
    name: loc.name,
    fullAddress: formatFullAddress(loc.tree, loc.name),
  };
}

/** Last-resort when PF omits a location id or the lookup fails. */
export function fallbackLocation(id?: number): AppPropertyLocation {
  return {
    id: id ?? 0,
    name: "Dubai",
    fullAddress: "Dubai, UAE.",
  };
}
