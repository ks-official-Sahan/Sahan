import type { Metadata } from "next";
import "@/style/globals.css";
import "@mantine/core/styles.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

import { MantineSyncProvider } from "@/components/theme/MantineSyncProvider";
import { poppins } from "@/lib/fonts";
import { Site, SiteMetadata } from "@/config/site";
import Footer from "@/components/foo/Footer";
import FloatingAudioSwitch from "@/components/common/FloatingAudioSwitch";

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import ShoelaceSetup from "@/components/animations/shoelace/shoelace-setup";
import Navigation from "@/components/nav/Navigation";
import { AudioProvider } from "@/context/AudioContext";

import { SpeedInsights } from "@vercel/speed-insights/next";
import LoadingScreen from "@/components/animations/LoadingScreen";
import JsonLd from "@/components/seo/JsonLd";

gsap.registerPlugin(useGSAP);

export const metadata: Metadata = {
  metadataBase: new URL(SiteMetadata.siteUrl),
  title: {
    default: `${SiteMetadata.title} | ${Site.myRole}`,
    template: `%s | ${SiteMetadata.title}`,
  },
  description: SiteMetadata.description,
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
        <JsonLd />
      </head>
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
                </ShoelaceSetup>
              </main>
            </AudioProvider>
          </MantineSyncProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
