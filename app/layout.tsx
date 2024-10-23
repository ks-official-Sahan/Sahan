import type { Metadata } from "next";
import "@/style/globals.css";
import '@mantine/core/styles.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider'

import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { poppins } from "@/lib/fonts";
import { SiteMetadata } from "@/config/site";
import Navbar from "@/components/nav/Navbar";
import Footer from "@/components/foo/Footer";
import { theme } from "@/config/mantine-theme";
import FloatingAudioSwitch from "@/components/common/FloatingAudioSwitch";

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import ShoelaceSetup from "@/components/animations/shoelace/shoelace-setup";


gsap.registerPlugin(useGSAP);


export const metadata: Metadata = {
  ...SiteMetadata
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
      <body className={`${poppins.className} antialiased  relative`}>

        <ThemeProvider
          enableSystem
          attribute='class'
          defaultTheme='dark'

        >
          <MantineProvider defaultColorScheme="dark" theme={theme}>
            <ShoelaceSetup>
              <Navbar />
              <FloatingAudioSwitch />
              {children}
              <Footer />
            </ShoelaceSetup>
          </MantineProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
