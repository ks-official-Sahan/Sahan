import React from "react";
import HomeHero from "@/components/home/HomeHero";
import TeamsMarquee from "@/components/home/TeamsMarquee";
import ProofStrip from "@/components/home/ProofStrip";
import FeaturedWorksSection from "@/components/home/FeaturedWorksSection";
import WhySection from "@/components/home/WhySection";
import ServiceOverviewSection from "@/components/home/ServiceOverviewSection";
import ProcessSection from "@/components/home/ProcessSection";
import ToolboxSection from "@/components/home/ToolboxSection";
import FAQSection from "@/components/home/FAQSection";
import FinalCta from "@/components/home/FinalCta";
import FaqJsonLd from "@/components/seo/FaqJsonLd";

// Story order: who (hero) -> proof (teams, numbers, work) -> why me -> what
// (services) -> how (process, tools) -> objections (FAQ) -> action (contact).
export default function Home() {
  return (
    <div>
      <HomeHero />
      <TeamsMarquee />
      <ProofStrip />
      <FeaturedWorksSection />
      <WhySection />
      <ServiceOverviewSection />
      <ProcessSection />
      <ToolboxSection />
      <FAQSection />
      <FinalCta />
      <FaqJsonLd />
    </div>
  );
}
