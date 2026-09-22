import "@mantine/core/styles.css";

import { useGSAP } from "@gsap/react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { gsap } from "gsap";

import LoadingScreen from "@/components/animations/LoadingScreen";
import ShoelaceSetup from "@/components/animations/shoelace/shoelace-setup";
import FloatingAudioSwitch from "@/components/common/FloatingAudioSwitch";
import Footer from "@/components/foo/Footer";
import Navigation from "@/components/nav/Navigation";
import JsonLd from "@/components/seo/JsonLd";
import { MantineSyncProvider } from "@/components/theme/MantineSyncProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AudioProvider } from "@/context/AudioContext";

gsap.registerPlugin(useGSAP);

/**
 * Public site chrome: skip link, providers, loading screen, navigation, audio
 * switch, footer. Rendered by app/(site)/layout.tsx and by the root 404
 * (app/not-found.tsx). Do not import it from the root layout or anything under
 * app/admin. The root 404 already puts its client references into every route
 * under the root layout, /admin included (see docs/plan/admin-cms-adr.md,
 * risk R19), and admin.css neutralises the Mantine CSS that comes with them.
 * Keep it free of Suspense boundaries and suspending awaits, or the 404 would
 * stream and answer 200.
 */
export default function SiteShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider enableSystem attribute="class" defaultTheme="dark">
      <JsonLd />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-full focus:bg-[#91FF00] focus:px-4 focus:py-2 focus:text-black focus:outline-none"
      >
        Skip to content
      </a>
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
  );
}
