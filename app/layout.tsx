import type { Metadata } from "next";
import "@/style/globals.css";
import "@mantine/core/styles.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { poppins } from "@/lib/fonts";
import { SiteMetadata } from "@/config/site";
import Footer from "@/components/foo/Footer";
import { theme } from "@/config/mantine-theme";
import FloatingAudioSwitch from "@/components/common/FloatingAudioSwitch";

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import ShoelaceSetup from "@/components/animations/shoelace/shoelace-setup";
import Navigation from "@/components/nav/Navigation";
import { AudioProvider } from "@/context/AudioContext";

import { SpeedInsights } from "@vercel/speed-insights/next";
import LoadingScreen from "@/components/animations/LoadingScreen";

gsap.registerPlugin(useGSAP);

export const metadata: Metadata = {
  ...SiteMetadata,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Mantine Color Scheme */}
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body className={`${poppins.className} antialiased relative`}>
        <ThemeProvider enableSystem attribute="class" defaultTheme="dark">
          <MantineProvider defaultColorScheme="dark" theme={theme}>
            <AudioProvider>
              <main className="flex flex-col min-h-screen w-full overflow-x-hidden">
                <ShoelaceSetup>
                  <LoadingScreen />
                  <Navigation />
                  <FloatingAudioSwitch />
                  <div className="pb-[300px]">{children}</div>
                  <Footer />
                  <SpeedInsights />
                </ShoelaceSetup>
              </main>
            </AudioProvider>
          </MantineProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
