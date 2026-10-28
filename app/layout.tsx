import type { Metadata } from "next";
import "@/style/globals.css";

import { poppins } from "@/lib/fonts";
import { Site, SiteMetadata } from "@/config/site";
import { documentTitle, metaDescription } from "@/lib/seo/copy";
import { siteUrl } from "@/lib/site-url";

// Thin root layout: the document, font and the metadata every route inherits.
// Public chrome lives in components/site/SiteShell.tsx (used by app/(site) and
// the root 404) and the admin has its own shell, so neither leaks into the other.
// The theme provider is mounted by SiteShell and by app/admin/layout.tsx, because
// the admin one needs the per-request CSP nonce, which this static layout cannot
// read. Design record: docs/plan/admin-cms-adr.md, section 4.3.
//
// openGraph and twitter stay here on purpose. app/opengraph-image.tsx sits at
// this level, and Next attaches its image to the openGraph object of the same
// segment; an openGraph defined in a child layout would replace that object and
// drop the image. The admin panel resets both to null.
// metadataBase is the host that answers its health check (lib/site-url.ts),
// so canonicals, the sitemap image, and Open Graph resolve there even when
// the preferred domain has no DNS yet. Relative metadata URLs inherit it.
export async function generateMetadata(): Promise<Metadata> {
  const origin = await siteUrl();
  const title = documentTitle(`${SiteMetadata.title} | ${Site.myRole}`);
  const description = metaDescription(SiteMetadata.description);
  return {
  metadataBase: new URL(origin),
  title: {
    default: title,
    template: `%s | ${SiteMetadata.title}`,
  },
  description,
  openGraph: {
    type: "website",
    url: origin,
    siteName: SiteMetadata.ogSiteName,
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    creator: SiteMetadata.twitterUsername,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.className} antialiased relative`}>{children}</body>
    </html>
  );
}
