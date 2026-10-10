"use client";

import CountUp from "@/components/home/CountUp";
import HeroBackdrop from "@/components/home/HeroBackdrop";
import { HomeContainer, stagger } from "@/components/home/HomeSection";
import WorksBehind from "@/components/works/WorksBehind";
import WorksExplorer from "@/components/works/WorksExplorer";
import type { PageContent } from "@/lib/cms/registry";
import { teamOf } from "@/contents/projects";
import type { Project } from "@/types/project";
import type { SkillCategory } from "@/types/skills";
import React, { ReactNode, Suspense } from "react";

interface WorksPageViewProps {
  content: PageContent<"works">;
  projects: Project[];
  finalCta: ReactNode;
  skillGroups: SkillCategory[] | null;
}

export default function WorksPageView({ content, projects, finalCta, skillGroups }: WorksPageViewProps) {
  const { hero } = content;
  const stats = [
    { value: projects.length, label: "Projects" },
    { value: projects.filter((project) => project.status === "live").length, label: "Live right now" },
    { value: new Set(projects.map(teamOf)).size, label: "Teams and clients" },
  ];

  return (
    <div className="w-full overflow-hidden font-medium">
      <section aria-labelledby="works-title" className="w-full">
        <HeroBackdrop>
          <div className="flex pb-[clamp(2.5rem,5vw,4rem)] pt-[clamp(6.5rem,12vw,9rem)]">
            <HomeContainer>
              <div className="flex flex-col items-start gap-6">
                <p
                  style={stagger(0)}
                  className="hero-rise inline-flex items-center gap-3 rounded-full border border-bBORDERFADE bg-bCHIP py-2 pl-3 pr-4 text-sm font-medium"
                >
                  <span
                    aria-hidden="true"
                    className="status-ping relative h-2.5 w-2.5 rounded-full bg-bICON text-bICON"
                  />
                  {hero.status}
                </p>

                <h1
                  id="works-title"
                  style={stagger(1)}
                  className="hero-rise max-w-[18ch] text-balance text-[length:clamp(2.25rem,1.1rem+4.6vw,5rem)] font-semibold leading-[1.04] tracking-[-0.03em]"
                >
                  {hero.title}
                </h1>

                <p
                  style={stagger(2)}
                  className="hero-rise max-w-[52ch] text-[length:clamp(1.05rem,0.9rem+0.5vw,1.3rem)] leading-relaxed opacity-70"
                >
                  {hero.description}
                </p>

                <dl
                  style={stagger(3)}
                  className="hero-rise mt-2 flex flex-wrap gap-x-10 gap-y-4"
                >
                  {stats.map((stat) => (
                    <div key={stat.label} className="flex flex-col gap-1">
                      <dt className="order-2 text-sm opacity-70">
                        {stat.label}
                      </dt>
                      <dd className="order-1 text-[length:clamp(2rem,1.4rem+2vw,3rem)] font-semibold leading-none tabular-nums">
                        <CountUp to={stat.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </HomeContainer>
          </div>
        </HeroBackdrop>
      </section>

      <Suspense fallback={<div className="h-24" />}>
        <WorksExplorer content={content} projects={projects} />
      </Suspense>
      <WorksBehind content={content} skillGroups={skillGroups} />
      {finalCta}
    </div>
  );
}
