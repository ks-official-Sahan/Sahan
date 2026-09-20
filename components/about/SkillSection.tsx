"use client";

import SkillGroupCard from "@/components/about/SkillGroupCard";
import TabChip from "@/components/about/TabChip";
import SkillCard from "@/components/common/SkillCard";
import TitleBlock from "@/components/common/TitleBlock";
import WrapperBody from "@/components/wrappers/WrapperBody";
import { AboutContent } from "@/contents/about";
import { MySkills } from "@/contents/skills";
import { cn } from "@/lib/utils";
import type { Skill } from "@/types/skills";
import React, { useMemo, useState } from "react";

const groupByType = (skills: Skill[]) => {
  const groups = new Map<string, Skill[]>();
  for (const skill of skills) {
    groups.set(skill.type, [...(groups.get(skill.type) ?? []), skill]);
  }
  return Array.from(groups.entries());
};

const SkillSection = () => {
  const { categories } = MySkills.tabs;
  const { layoutFilter } = MySkills;

  const [layout, setLayout] = useState(layoutFilter.options[0].id);
  const [selectedId, setSelectedId] = useState(categories[0].id);

  const selected =
    categories.find((category) => category.id === selectedId) ?? categories[0];
  const groups = useMemo(() => groupByType(selected.skills), [selected]);

  return (
    <section id="skills" className="flex flex-col items-center pt-[80px]">
      <WrapperBody>
        <div className="flex flex-col">
          {/* TITLE & LAYOUT SWITCH */}
          <div className="flex items-end justify-between gap-6 sm:flex-col sm:items-start">
            <TitleBlock
              isBadge
              isSubtitle
              titleAs="h2"
              icon={<span aria-hidden="true">🚀</span>}
              title={AboutContent.KB.title}
              subtitle={AboutContent.KB.description}
              label="Skills"
              titleClass="text-[2rem] font-bold uppercase pt-[12px]"
            />

            <div
              role="group"
              aria-label="Skill layout"
              className="flex items-center gap-[10px] rounded-[10px] border bg-bCHIP py-[6px] pl-4 pr-[10px]"
            >
              <span className="text-[14px] font-medium opacity-65">
                {layoutFilter.label}
              </span>
              {layoutFilter.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={layout === option.id}
                  onClick={() => setLayout(option.id)}
                  className={cn(
                    "rounded-[10px] border px-4 py-[6px] text-[14px] font-medium transition-colors",
                    layout === option.id
                      ? "bg-bICON_FADE text-bICON"
                      : "bg-border opacity-80 hover:opacity-100"
                  )}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </div>

          {layout === layoutFilter.options[0].id ? (
            <div className="flex w-full flex-col pt-12">
              {/* CATEGORIES */}
              <div
                role="tablist"
                aria-label="Skill categories"
                className="flex flex-wrap gap-3"
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

              {/* SEPARATOR */}
              <div className="mt-6 h-px w-full bg-border" />

              {/* SKILLS */}
              <div
                role="tabpanel"
                id="skill-panel"
                aria-labelledby={`skill-tab-${selected.id}`}
                className="grid gap-5 pt-8 lg:grid-cols-2"
              >
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
          ) : (
            <div className="flex flex-wrap justify-center pt-12">
              {AboutContent.KB.skills.dev.map((skill) => {
                const IconComponent = skill.icon;
                const isStroke = skill.variant === "stroke";

                return (
                  <SkillCard
                    key={skill.title}
                    title={skill.title}
                    bgColors={skill.bgColors}
                    colors={skill.colors}
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
        </div>
      </WrapperBody>
    </section>
  );
};

export default SkillSection;
