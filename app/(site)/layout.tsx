import type { Metadata } from "next";

import PageViewBeacon from "@/components/site/analytics/PageViewBeacon";
import ChatWidgetLoader from "@/components/site/chat/ChatWidgetLoader";
import SiteShell from "@/components/site/SiteShell";
import { SiteMetadata } from "@/config/site";
import { chatbotEnabled } from "@/lib/ai/availability";
import { RSS_ALTERNATES } from "@/lib/metadata";
import { getSetting } from "@/lib/settings/service";
import { siteUrl } from "@/lib/site-url";

// Site-only metadata. Everything else (title, description, openGraph, twitter,
// robots, metadataBase) comes from the root layout, so the merged head of every
// public page matches what it was before the route groups existed.
export async function generateMetadata(): Promise<Metadata> {
  const origin = await siteUrl();
  return {
    authors: [{ name: SiteMetadata.author, url: origin }],
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
      canonical: "/",
      types: RSS_ALTERNATES,
    },
  };
}

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [features, chatbotConfig, origin] = await Promise.all([
    getSetting("features"),
    getSetting("chatbot.config"),
    siteUrl(),
  ]);

  return (
    <SiteShell origin={origin}>
      {children}
      <PageViewBeacon />
      {features.chatbotEnabled && chatbotEnabled() && (
        <ChatWidgetLoader enabled config={chatbotConfig} siteUrl={origin} />
      )}
    </SiteShell>
  );
}
