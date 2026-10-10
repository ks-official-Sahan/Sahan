import { SiteMetadata } from "@/config/site";
import { getIndexablePostPage, SITEMAP_PAGE_SIZE } from "@/lib/blog/queries";
import { getPageLastModified } from "@/lib/cms/loaders";
import type { CmsPage } from "@/lib/cms/registry";
import { sitemapIds, sitemapStart } from "@/lib/seo/sitemap";
import type { MetadataRoute } from "next";

// One file per SITEMAP_PAGE_SIZE indexable posts at /sitemaps/sitemap/<id>.xml,
// the first also carrying the five static routes. /sitemap.xml is the index
// over them (app/sitemap.xml/route.ts); ids come from lib/seo/sitemap.ts.

const STATIC_ROUTES: Array<{ path: string; page: CmsPage | null }> = [
  { path: "", page: "home" },
  { path: "/about", page: "about" },
  { path: "/works", page: "works" },
  { path: "/updates", page: null },
  { path: "/contact", page: "contact" },
];

/** Cursor-backed sitemap ids avoid large offset scans and keep sitemap reads bounded. */
export async function generateSitemaps(): Promise<Array<{ id: string }>> {
  return (await sitemapIds()).map((id) => ({ id }));
}

// Revalidated every 300 s, and right after CMS writes: post and SEO plans in
// lib/cache/plan.ts carry SITEMAP_PATHS, which revalidates every file under
// /sitemaps along with the /sitemap.xml index, and the files' reads are cached
// under blog:list. `id` is a promise in this Next version.
export const revalidate = 300;

export default async function sitemap({ id: idPromise }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = await idPromise;
  const after = await sitemapStart(id);
  if (after === null) return [];

  const isFirst = after === undefined;
  const [page, lastModifiedByRoute] = await Promise.all([
    getIndexablePostPage(SITEMAP_PAGE_SIZE, after),
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
