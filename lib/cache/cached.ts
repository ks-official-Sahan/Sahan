import "server-only";

import { unstable_cache } from "next/cache";

// The only file that wraps Next's data cache. `unstable_cache` is documented as
// replaced by `use cache` in Next 16 (docs/plan/admin-cms-adr.md, D3, R1), so a
// later move to Cache Components changes this file and nothing else.

/** Safety net: ISR revalidates at least this often even without a publish. */
export const DEFAULT_REVALIDATE_SECONDS = 3600;

export function cacheKey(...parts: string[]): string[] {
  return ["sahan", ...parts];
}

/**
 * Caches an async read under `keyParts`, tagged for on-demand invalidation.
 * Never put a code-default fallback inside `fn`: throw instead and use
 * loadOrNull() outside, so a fallback is never cached.
 */
export function cached<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: string[],
  options: { tags: string[]; revalidate?: number | false }
): (...args: Args) => Promise<Result> {
  return unstable_cache(fn, cacheKey(...keyParts), {
    tags: options.tags,
    revalidate: options.revalidate ?? DEFAULT_REVALIDATE_SECONDS,
  });
}
