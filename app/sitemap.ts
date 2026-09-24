import { SiteMetadata } from "@/config/site";
import { getPosts } from "@/lib/blog/queries";
import { getPageLastModified } from "@/lib/cms/loaders";
import type { CmsPage } from "@/lib/cms/registry";
import type { MetadataRoute } from "next";

// Revalidated on a fixed schedule instead of per request: lastModified now
// comes from cached CMS reads (getPageLastModified) and getPosts() instead of
// `new Date()` on every crawl, so there is no correctness reason left to force
// dynamic rendering here. A publish still shows up within this window (or
// sooner — lib/cache/plan.ts's forPost()/forPostList()/forCollection() already
// revalidatePath("/sitemap.xml") on the relevant actions).
export const revalidate = 300;

const STATIC_ROUTES: Array<{ path: string; page: CmsPage | null }> = [
  { path: "", page: "home" },
  { path: "/about", page: "about" },
  { path: "/works", page: "works" },
  // /updates has no single CMS page block driving it the way the others do —
  // its lastModified comes from the newest post's publishedAt instead, below.
  { path: "/updates", page: null },
  { path: "/contact", page: "contact" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, lastModifiedByRoute] = await Promise.all([
    getPosts(),
    Promise.all(STATIC_ROUTES.map((route) => (route.page ? getPageLastModified(route.page) : Promise.resolve(null)))),
  ]);

  const newestPostAt = posts[0]?.publishedAt ? new Date(posts[0].publishedAt).toISOString() : null;

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route, index) => {
    // No stored CMS block yet (still on code defaults) or no posts published
    // yet: omit lastModified rather than fabricate one with `new Date()`.
    const lastModified = route.path === "/updates" ? newestPostAt : lastModifiedByRoute[index];
    return {
      url: `${SiteMetadata.siteUrl}${route.path}`,
      ...(lastModified ? { lastModified: new Date(lastModified) } : {}),
      changeFrequency: route.path === "" ? "weekly" : "monthly",
      priority: route.path === "" ? 1 : 0.7,
    };
  });

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SiteMetadata.siteUrl}/updates/${post.slug}`,
    lastModified: post.publishedAt ? new Date(post.publishedAt) : new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...postEntries];
}
