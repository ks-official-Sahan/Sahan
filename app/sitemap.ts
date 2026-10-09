import { SiteMetadata } from "@/config/site";
import { decodePublicPostCursor, encodePublicPostCursor, getIndexablePostPage } from "@/lib/blog/queries";
import { getPageLastModified } from "@/lib/cms/loaders";
import type { CmsPage } from "@/lib/cms/registry";
import type { MetadataRoute } from "next";

// Keep each page comfortably below the sitemap protocol's 50,000 URL limit,
// including five static routes in the first file. Each chunk is independently
// cached and invalidated with the normal blog list tag/path.
const POSTS_PER_SITEMAP = 1_000;
const FIRST_SITEMAP_ID = "first";

const STATIC_ROUTES: Array<{ path: string; page: CmsPage | null }> = [
  { path: "", page: "home" },
  { path: "/about", page: "about" },
  { path: "/works", page: "works" },
  { path: "/updates", page: null },
  { path: "/contact", page: "contact" },
];

/** Cursor-backed sitemap ids avoid large offset scans and keep sitemap reads bounded. */
export async function generateSitemaps(): Promise<Array<{ id: string }>> {
  const ids: Array<{ id: string }> = [];
  let cursor: { publishedAt: string; id: string } | undefined;
  while (true) {
    ids.push({ id: cursor ? `after-${encodePublicPostCursor(cursor)}` : FIRST_SITEMAP_ID });
    const page = await getIndexablePostPage(POSTS_PER_SITEMAP, cursor);
    if (!page.nextCursor) break;
    if (cursor && page.nextCursor.id === cursor.id && page.nextCursor.publishedAt === cursor.publishedAt) break;
    cursor = page.nextCursor;
  }
  return ids;
}

// Revalidated on a fixed schedule and immediately after CMS writes through
// revalidatePath('/sitemap.xml'). `id` is a promise in this Next version.
export const revalidate = 300;

export default async function sitemap({ id: idPromise }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = await idPromise;
  const after = id === FIRST_SITEMAP_ID ? undefined : decodePublicPostCursor(id.startsWith("after-") ? id.slice(6) : null);
  if (after === null) return [];

  const isFirst = after === undefined;
  const [page, lastModifiedByRoute] = await Promise.all([
    getIndexablePostPage(POSTS_PER_SITEMAP, after),
    isFirst
      ? Promise.all(STATIC_ROUTES.map((route) => (route.page ? getPageLastModified(route.page) : Promise.resolve(null))))
      : Promise.resolve([] as Array<string | null>),
  ]);
  const newestPostAt = page.items[0]?.publishedAt ? new Date(page.items[0].publishedAt).toISOString() : null;

  const staticEntries: MetadataRoute.Sitemap = isFirst
    ? STATIC_ROUTES.map((route, index) => {
        const lastModified = route.path === "/updates" ? newestPostAt : lastModifiedByRoute[index];
        return {
          url: `${SiteMetadata.siteUrl}${route.path}`,
          ...(lastModified ? { lastModified: new Date(lastModified) } : {}),
          changeFrequency: route.path === "" ? "weekly" : "monthly",
          priority: route.path === "" ? 1 : 0.7,
        };
      })
    : [];

  const postEntries: MetadataRoute.Sitemap = page.items.map((post) => {
    const lastModified = post.updatedAt ?? post.publishedAt;
    return {
      url: `${SiteMetadata.siteUrl}/updates/${post.slug}`,
      ...(lastModified ? { lastModified: new Date(lastModified) } : {}),
      changeFrequency: "monthly",
      priority: 0.6,
    };
  });

  return [...staticEntries, ...postEntries];
}
