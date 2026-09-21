import type { Metadata } from "next";
import "@/style/globals.css";

import { poppins } from "@/lib/fonts";
import { Site, SiteMetadata } from "@/config/site";
<<<<<<< HEAD
=======
import Footer from "@/components/foo/Footer";
import FloatingAudioSwitch from "@/components/common/FloatingAudioSwitch";

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import ShoelaceSetup from "@/components/animations/shoelace/shoelace-setup";
import Navigation from "@/components/nav/Navigation";
import { AudioProvider } from "@/context/AudioContext";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import LoadingScreen from "@/components/animations/LoadingScreen";
import JsonLd from "@/components/seo/JsonLd";

gsap.registerPlugin(useGSAP);
>>>>>>> origin/master

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
export const metadata: Metadata = {
  metadataBase: new URL(SiteMetadata.siteUrl),
  title: {
    default: `${SiteMetadata.title} | ${Site.myRole}`,
    template: `%s | ${SiteMetadata.title}`,
  },
  description: SiteMetadata.description,
  openGraph: {
    type: "website",
    url: SiteMetadata.siteUrl,
    siteName: SiteMetadata.ogSiteName,
    title: SiteMetadata.title,
    description: SiteMetadata.description,
  },
  twitter: {
    card: "summary_large_image",
    title: SiteMetadata.title,
    description: SiteMetadata.description,
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "window.litDisableDevMode = true;",
          }}
        />
      </head>
<<<<<<< HEAD
      <body className={`${poppins.className} antialiased relative`}>{children}</body>
=======
      <body className={`${poppins.className} antialiased relative`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-full focus:bg-[#91FF00] focus:px-4 focus:py-2 focus:text-black focus:outline-none"
        >
          Skip to content
        </a>
        <ThemeProvider enableSystem attribute="class" defaultTheme="dark">
          <MantineSyncProvider>
            <AudioProvider>
              <main className="flex flex-col min-h-screen w-full overflow-x-hidden">
                <ShoelaceSetup>
                  <LoadingScreen />
                  <Navigation />
                  <FloatingAudioSwitch />
                  <div id="main-content" className="pb-[300px]">
                    {children}
                  </div>
                  <Footer />
                  <SpeedInsights />
                  <Analytics />
                </ShoelaceSetup>
              </main>
            </AudioProvider>
          </MantineSyncProvider>
        </ThemeProvider>
      </body>
>>>>>>> origin/master
    </html>
  );
}
