import { SiteMetadata } from "@/config/site";
import { getPosts } from "@/lib/blog/queries";
import type { MetadataRoute } from "next";

// The sitemap is generated per request (no revalidate export here, matching
// the file as it stood before this step), so a newly published post appears
// on the next crawl without a separate cache-tag concern
// (docs/plan/admin-cms-adr.md, Step 12).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = ["", "/about", "/works", "/updates", "/contact"];

  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${SiteMetadata.siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));

  const posts = await getPosts();
  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SiteMetadata.siteUrl}/updates/${post.slug}`,
    lastModified: post.publishedAt ? new Date(post.publishedAt) : new Date(),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...postEntries];
}
