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
      url,
      title,
      description,
    },
    twitter: {
      title,
      description,
    },
  };
}
