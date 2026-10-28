import type { Metadata } from "next";
import { SiteMetadata } from "@/config/site";
import { documentTitle, metaDescription } from "@/lib/seo/copy";

// Feed discovery (<link rel="alternate" type="application/rss+xml">). The URL
// is relative so the root layout's metadataBase (the host that actually
// answers) makes it absolute. Next merges `alternates` shallowly, so every
// segment that sets a canonical must repeat this or the feed link disappears.
export const RSS_ALTERNATES: NonNullable<Metadata["alternates"]>["types"] = {
  "application/rss+xml": [{ url: "/rss.xml", title: `${SiteMetadata.author} — Updates` }],
};

export function pageMetadata(
  path: string,
  { title, description }: { title: string; description: string }
): Metadata {
  const canonical = path.startsWith("/") ? path : `/${path}`;
  const fullTitle = documentTitle(title);
  const summary = metaDescription(description);

  return {
    title: { absolute: fullTitle },
    description: summary,
    alternates: { canonical, types: RSS_ALTERNATES },
    openGraph: {
      type: "website",
      siteName: SiteMetadata.ogSiteName,
      url: canonical,
      title: fullTitle,
      description: summary,
      images: [{ url: "/opengraph-image", alt: summary }],
    },
    twitter: {
      card: "summary_large_image",
      creator: SiteMetadata.twitterUsername,
      title: fullTitle,
      description: summary,
    },
  };
}
