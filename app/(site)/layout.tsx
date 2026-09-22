import type { Metadata } from "next";
import dynamic from "next/dynamic";

import SiteShell from "@/components/site/SiteShell";
import { SiteMetadata } from "@/config/site";
import { getPublicSettings } from "@/lib/settings/service";

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

// Lazy-load the chat widget with ssr:false to avoid hydration mismatch
const ChatWidget = dynamic(() => import("@/components/site/chat/ChatWidget"), {
  ssr: false,
});

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get settings to check if chatbot is enabled
  const settings = await getPublicSettings();
  const features = (settings.features as any) || { chatbotEnabled: true };
  const chatbotEnabled = features.chatbotEnabled === true;
  const chatbotConfig = ((settings["chatbot.config"] as any) || {
    enabled: true,
    tone: "professional" as const,
    greeting: "Hi! How can I help?",
    trainingDataVersion: 0,
  }) as any;

  return (
    <SiteShell>
      {children}
      {chatbotEnabled && (
        <ChatWidget enabled={true} config={chatbotConfig} siteUrl={SiteMetadata.siteUrl} />
      )}
    </SiteShell>
  );
}
