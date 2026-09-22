"use client";

import SkillGroupCard from "@/components/about/SkillGroupCard";
import TabChip from "@/components/about/TabChip";
import ChipMarquee from "@/components/common/ChipMarquee";
import SkillCard from "@/components/common/SkillCard";
import SkillChip from "@/components/common/SkillChip";
import HomeSection from "@/components/home/HomeSection";
import SectionHeading from "@/components/home/SectionHeading";
import { MySkills } from "@/contents/skills";
import type { PageContent } from "@/lib/cms/registry";
import { cn } from "@/lib/utils";
import type { Skill } from "@/types/skills";
import React, { useMemo, useState } from "react";

interface SkillSectionProps {
  content: PageContent<"about">;
}

const groupByType = (skills: Skill[]) => {
  const groups = new Map<string, Skill[]>();
  for (const skill of skills) {
    groups.set(skill.type, [...(groups.get(skill.type) ?? []), skill]);
  }
  return Array.from(groups.entries());
};

const SkillSection = ({ content }: SkillSectionProps) => {
  const { categories } = MySkills.tabs;
  const { layoutFilter } = MySkills;

  const [layout, setLayout] = useState(layoutFilter.options[0].id);
  const [selectedId, setSelectedId] = useState(categories[0].id);

  const selected =
    categories.find((category) => category.id === selectedId) ?? categories[0];
  const groups = useMemo(() => groupByType(selected.skills), [selected]);

  const allSkills = useMemo(() => {
    const seen = new Set<string>();
    const skills: Skill[] = [];
    for (const category of categories) {
      for (const skill of category.skills) {
        if (seen.has(skill.name)) continue;
        seen.add(skill.name);
        skills.push(skill);
      }
    }
    return skills;
  }, [categories]);

  return (
    <HomeSection id="skills" labelledBy="skills-title">
      <SectionHeading
        id="skills-title"
        title={content.skills.title}
        description={content.skills.description}
        action={
          <div
            role="group"
            aria-label="Skill layout"
            className="flex items-center gap-2 rounded-full border border-bBORDERFADE bg-bCARD p-1"
          >
            {layoutFilter.options.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={layout === option.id}
                onClick={() => setLayout(option.id)}
                className={cn(
                  "press min-h-10 rounded-full px-5 text-sm font-medium transition-colors",
                  layout === option.id
                    ? "bg-bICON_FADE text-bICON"
                    : "opacity-80 hover:opacity-100"
                )}
              >
                {option.name}
              </button>
            ))}
          </div>
        }
      />

      {layout === layoutFilter.options[0].id ? (
        <div className="mt-10 flex w-full flex-col">
          {/* CATEGORIES: scrolls sideways when they do not fit */}
          <div
            role="tablist"
            aria-label="Skill categories"
            className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 [scroll-padding-inline:1rem] s640:-mx-8 s640:px-8 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
          >
            {categories.map((category) => (
              <TabChip
                key={category.id}
                id={`skill-tab-${category.id}`}
                controls="skill-panel"
                title={category.category}
                selected={selectedId === category.id}
                onClick={() => setSelectedId(category.id)}
              />
            ))}
          </div>

          {/* SKILLS: keyed so switching tabs replays the entrance */}
          <div
            key={selected.id}
            role="tabpanel"
            id="skill-panel"
            aria-labelledby={`skill-tab-${selected.id}`}
            className="swap-in flex flex-col gap-6 pt-6"
          >
            <ChipMarquee
              label={`${selected.category} skills`}
              minItems={6}
              duration={30}
            >
              {selected.skills.map((skill) => (
                <SkillChip key={skill.name} skill={skill} />
              ))}
            </ChipMarquee>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {groups.map(([type, skills]) => (
                <SkillGroupCard
                  key={`${selected.id}-${type}`}
                  type={type}
                  skills={skills}
                  className={
                    groups.length === 1
                      ? "lg:col-span-2 lg:mx-auto lg:w-full lg:max-w-xl"
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center pt-12">
          {allSkills.map((skill) => {
            const IconComponent = skill.icon;
            const isStroke = skill.variant === "stroke";

            return (
              <SkillCard
                key={skill.name}
                title={skill.name}
                icon={
                  isStroke ? (
                    <IconComponent
                      size={40}
                      className="text-black dark:text-white group-hover/canvas-card:text-white"
                    />
                  ) : (
                    <IconComponent className="fill-black dark:fill-white group-hover/canvas-card:fill-white" />
                  )
                }
              />
            );
          })}
        </div>
      )}
    </HomeSection>
  );
};

export default SkillSection;
