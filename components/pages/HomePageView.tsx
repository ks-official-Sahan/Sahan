import React from "react";
import type { PageContent } from "@/lib/cms/registry";
import type { Project } from "@/types/project";
import type { ExperienceEntry } from "@/types/experience";
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

interface HomePageViewProps {
  content: PageContent<"home">;
  projects: Project[];
  experience: ExperienceEntry[];
}

// Story order: who (hero) -> proof (teams, numbers, work) -> why me -> what
// (services) -> how (process, tools) -> objections (FAQ) -> action (contact).
export default function HomePageView({ content, projects, experience }: HomePageViewProps) {
  return (
    <div>
      <HomeHero content={content.hero} channels={content.channels} />
      <TeamsMarquee content={content.teams} experience={experience} />
      <ProofStrip content={content.proof} projects={projects} />
      <FeaturedWorksSection content={content.home} projects={projects} />
      <WhySection content={content.why} />
      <ServiceOverviewSection content={content.home} />
      <ProcessSection content={content.process} labels={content.home} />
      <ToolboxSection content={content.home} />
      <FAQSection content={content.faq} labels={content.home} />
      <FinalCta content={content.finalCta} channels={content.channels} />
      <FaqJsonLd content={content.faq} />
    </div>
  );
}
