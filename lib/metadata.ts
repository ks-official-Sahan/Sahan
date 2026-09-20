import type { Metadata } from "next";
import { SiteMetadata } from "@/config/site";

export function pageMetadata(
  path: string,
  { title, description }: { title: string; description: string }
): Metadata {
  const url = `${SiteMetadata.siteUrl}${path}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SiteMetadata.ogSiteName,
      url,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      creator: SiteMetadata.twitterUsername,
      title,
      description,
    },
  };
}
