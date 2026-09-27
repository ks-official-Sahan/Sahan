import AboutBento from "@/components/about/AboutBento";
import AboutHero from "@/components/about/AboutHero";
import ExperienceSection from "@/components/about/ExperienceSection";
import ServiceSection from "@/components/about/ServiceSection";
import SkillSection from "@/components/about/SkillSection";
import FinalCta from "@/components/home/FinalCta";
import ProofStrip from "@/components/home/ProofStrip";
import type { PageContent } from "@/lib/cms/registry";
import type { GitHubStats } from "@/lib/github";
import type { Project } from "@/types/project";
import React from "react";

interface AboutPageViewProps {
  content: PageContent<"about">;
  home: PageContent<"home">;
  githubStats: GitHubStats;
  projects: Project[];
}

// Story order: who -> proof -> the person behind it -> what I do -> what I
// use -> where I have done it -> how to reach me.
const AboutPageView = ({ content, home, githubStats, projects }: AboutPageViewProps) => (
  <div className="w-full overflow-hidden font-medium">
    <AboutHero content={content} channels={home.channels} />
    <ProofStrip content={home.proof} projects={projects} />
    <AboutBento content={content} githubStats={githubStats} />
    <ServiceSection content={content} home={home} />
    <SkillSection content={content} />
    <ExperienceSection content={content} />
    <FinalCta content={home.finalCta} channels={home.channels} />
  </div>
);

export default AboutPageView;
