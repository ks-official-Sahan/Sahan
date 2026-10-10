import "server-only";

import { decodePublicPostCursor, encodePublicPostCursor, getSitemapCursors, type PublicPostCursor } from "@/lib/blog/queries";

// Sitemap file ids, shared by app/sitemaps/sitemap.ts (each file at
// /sitemaps/sitemap/<id>.xml) and app/sitemap.xml/route.ts (the index
// robots.txt points at). Next does not generate an index for
// generateSitemaps(), so /sitemap.xml is served by that route. The first file
// is "first"; each later one is "after-<cursor>", the keyset cursor its posts
// start after, so no file needs an offset scan.

export const FIRST_SITEMAP_ID = "first";
const AFTER_PREFIX = "after-";

/** Every current sitemap file id, from one cached read. */
export async function sitemapIds(): Promise<string[]> {
  const cursors = await getSitemapCursors();
  return [FIRST_SITEMAP_ID, ...cursors.map((cursor) => `${AFTER_PREFIX}${encodePublicPostCursor(cursor)}`)];
}

/**
 * Where a sitemap file's posts start: undefined for the first file, a cursor
 * for a later one, or null when `id` is not a current sitemap id. Unknown ids
 * are rejected against the cached id list, so a guessed or stale id costs no
 * database read.
 */
export async function sitemapStart(id: string): Promise<PublicPostCursor | undefined | null> {
  if (id === FIRST_SITEMAP_ID) return undefined;
  if (!id.startsWith(AFTER_PREFIX) || !(await sitemapIds()).includes(id)) return null;
  return decodePublicPostCursor(id.slice(AFTER_PREFIX.length)) ?? null;
}
