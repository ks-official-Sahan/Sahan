import type { Metadata } from "next";

import SiteShell from "@/components/site/SiteShell";
import { SiteMetadata } from "@/config/site";

// Site-only metadata. Everything else (title, description, openGraph, twitter,
// robots, metadataBase) comes from the root layout, so the merged head of every
// public page matches what it was before the route groups existed.
export const metadata: Metadata = {
  authors: [{ name: SiteMetadata.author, url: SiteMetadata.siteUrl }],
  creator: SiteMetadata.author,
  keywords: [
    "Sahan Sachintha",
    "Full-Stack Software Engineer",
    "Next.js Developer",
    "React Native Developer",
    "Software Engineer Sri Lanka",
    "Datalake Creative",
  ],
  alternates: {
    canonical: SiteMetadata.siteUrl,
  },
};

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <SiteShell>{children}</SiteShell>;
}
