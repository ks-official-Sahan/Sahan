import AboutBento from "@/components/about/AboutBento";
import AboutHero from "@/components/about/AboutHero";
import ExperienceSection from "@/components/about/ExperienceSection";
import ServiceSection from "@/components/about/ServiceSection";
import SkillSection from "@/components/about/SkillSection";
import FinalCta from "@/components/home/FinalCta";
import ProofStrip from "@/components/home/ProofStrip";
import type { GitHubStats } from "@/lib/github";
import React from "react";

// Story order: who -> proof -> the person behind it -> what I do -> what I
// use -> where I have done it -> how to reach me.
const AboutPageClient = ({ githubStats }: { githubStats: GitHubStats }) => (
  <div className="w-full overflow-hidden font-medium">
    <AboutHero />
    <ProofStrip />
    <AboutBento githubStats={githubStats} />
    <ServiceSection />
    <SkillSection />
    <ExperienceSection />
    <FinalCta />
  </div>
);

export default AboutPageClient;
