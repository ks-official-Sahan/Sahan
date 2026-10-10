import { SiteMetadata } from "@/config/site";
import { sitemapIds } from "@/lib/seo/sitemap";

// Sitemap index at /sitemap.xml, the URL app/robots.ts advertises. With
// generateSitemaps() (app/sitemaps/sitemap.ts) Next serves only the files
// themselves, at /sitemaps/sitemap/<id>.xml, and no index, so this route
// lists them. (A sitemap.ts at the app root would claim /sitemap.xml itself,
// which is why the files live one segment down.) It reads the same cached id
// list as the files, invalidated with blog:list.

export const revalidate = 300;

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export async function GET() {
  const ids = await sitemapIds();
  const entries = ids
    .map((id) => `  <sitemap>\n    <loc>${escapeXml(`${SiteMetadata.siteUrl}/sitemaps/sitemap/${id}.xml`)}</loc>\n  </sitemap>`)
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
