import AvailableCard from "@/components/about/AvailableCard";
import GitHubStatsCard from "@/components/about/GitHubStatsCard";
import CountUp from "@/components/home/CountUp";
import HomeSection from "@/components/home/HomeSection";
import SectionHeading from "@/components/home/SectionHeading";
import { Experience } from "@/contents/experience";
import { Projects } from "@/contents/projects";
import type { PageContent } from "@/lib/cms/registry";
import type { GitHubStats } from "@/lib/github";
import { cn } from "@/lib/utils";
import { Briefcase } from "lucide-react";
import React from "react";

interface AboutBentoProps {
  content: PageContent<"about">;
  githubStats: GitHubStats;
}

const card =
  "flex flex-col gap-4 rounded-[16px] border border-bBORDERFADE bg-bCARD p-6";

const currentRole = Experience.find((entry) => entry.current);
const freelanceCount = Projects.filter(
  (project) => project.category === "freelance"
).length;
const companiesCount = new Set(
  Experience.filter((entry) => entry.type !== "freelance").map(
    (entry) => entry.company
  )
).size;

// Asymmetric on purpose: the story card is the widest thing on the page, the
// numbers are the smallest. Phones stack it, tablets pair it up, laptops get
// the four-column bento.
const AboutBento = ({ content, githubStats }: AboutBentoProps) => {
  const { bento } = content;
  return (
  <HomeSection id="story" labelledBy="story-title">
    <SectionHeading id="story-title" title={bento.title} />

    <div className="reveal mt-10 grid grid-cols-1 gap-4 s640:grid-cols-2 lg:grid-cols-4">
      {/* story */}
      <div className={cn(card, "s640:col-span-2 lg:row-span-2")}>
        <h3 className="text-xl font-semibold">{bento.cardTitle}</h3>
        <p className="max-w-[60ch] text-base leading-relaxed opacity-70">
          {bento.cardDescription}
        </p>
      </div>

      {/* now */}
      <div className={cn(card, "s640:col-span-2")}>
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-bICON_FADE text-bICON"
        >
          <Briefcase size={18} />
        </span>
        <div>
          <div className="text-lg font-semibold">{currentRole?.role}</div>
          <div className="text-sm opacity-70">
            {currentRole?.company}, {currentRole?.period}
          </div>
        </div>
        {currentRole?.highlights[0] && (
          <p className="text-sm leading-relaxed opacity-70">
            {currentRole.highlights[0]}
          </p>
        )}
      </div>

      {/* numbers */}
      <div className={card}>
        <div className="text-[length:clamp(2rem,1.4rem+2vw,3rem)] font-semibold leading-none tabular-nums">
          <CountUp to={companiesCount} />
        </div>
        <div className="text-sm opacity-70">{bento.companiesLabel}</div>
      </div>
      <div className={card}>
        <div className="text-[length:clamp(2rem,1.4rem+2vw,3rem)] font-semibold leading-none tabular-nums">
          <CountUp to={freelanceCount} />
        </div>
        <div className="text-sm opacity-70">{bento.freelanceLabel}</div>
      </div>

      {/* live */}
      <div className={cn(card, "s640:col-span-2 items-center justify-center")}>
        <GitHubStatsCard stats={githubStats} content={bento} />
      </div>
      <div className={cn(card, "s640:col-span-2 items-center justify-center")}>
        <AvailableCard content={bento} />
      </div>
    </div>
  </HomeSection>
);
};

export default AboutBento;
