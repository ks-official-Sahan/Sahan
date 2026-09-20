import React from "react";
import HomeHero from "@/components/home/HomeHero";
import ProofStrip from "@/components/home/ProofStrip";
import FeaturedWorksSection from "@/components/home/FeaturedWorksSection";
import ServiceOverviewSection from "@/components/home/ServiceOverviewSection";
import ProcessSection from "@/components/home/ProcessSection";
import ToolboxSection from "@/components/home/ToolboxSection";
import FAQSection from "@/components/home/FAQSection";
import FinalCta from "@/components/home/FinalCta";
import FaqJsonLd from "@/components/seo/FaqJsonLd";

// Story order: who (hero) -> proof (numbers, work) -> what (services) ->
// how (process, tools) -> objections (FAQ) -> action (contact).
export default function Home() {
  return (
    <div>
      <HomeHero />
      <ProofStrip />
      <FeaturedWorksSection />
      <ServiceOverviewSection />
      <ProcessSection />
      <ToolboxSection />
      <FAQSection />
      <FinalCta />
      <FaqJsonLd />
    </div>
  );
}
