"use client";

import TitleBlock from "@/components/common/TitleBlock";
import Marquee from "@/components/ui/marquee";
import { cn } from "@/lib/utils";
import type { Skill } from "@/types/skills";
import React, { useState } from "react";

// Brand colours are exposed as CSS variables (light + dark) instead of being
// picked in JS from the current theme. That keeps server and client markup
// identical (no theme-dependent hydration mismatch) and lets Tailwind's
// `dark:` variant switch them.
const skillVars = (skill: Skill) =>
  ({
    "--skill-light": skill.baseColor.light,
    "--skill-dark": skill.baseColor.dark,
    "--skill-light-tint": `${skill.baseColor.light}2e`,
    "--skill-dark-tint": `${skill.baseColor.dark}2e`,
  }) as React.CSSProperties;

const colorClass =
  "text-[color:var(--skill-light)] dark:text-[color:var(--skill-dark)]";
const tintClass =
  "bg-[color:var(--skill-light-tint)] dark:bg-[color:var(--skill-dark-tint)]";

const SkillIcon = ({ skill, size }: { skill: Skill; size: number }) => {
  if (skill.variant === "stroke") {
    return <skill.icon size={size} stroke={1.5} />;
  }

  return (
    <span
      className="inline-flex [&>svg]:h-full [&>svg]:w-full"
      style={{ width: size, height: size }}
    >
      <skill.icon className="fill-current" />
    </span>
  );
};

const SkillGroupCard = ({
  type,
  skills,
  className,
}: {
  type: string;
  skills: Skill[];
  className?: string;
}) => {
  const [selectedName, setSelectedName] = useState(skills[0].name);
  const selected = skills.find((skill) => skill.name === selectedName) ?? skills[0];

  return (
    <div
      style={skillVars(selected)}
      className={cn(
        "relative flex min-h-[280px] items-stretch justify-between gap-4 overflow-hidden rounded-[12px] border border-bBORDERFADE bg-bCARD p-5",
        className
      )}
    >
      {/* GLOW */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -left-8 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full blur-3xl",
          tintClass
        )}
      />

      {/* SELECTED SKILL */}
      <div className="relative flex flex-col justify-between">
        <div aria-hidden="true" className={colorClass}>
          <SkillIcon skill={selected} size={96} />
        </div>

        <TitleBlock
          className="flex flex-col-reverse"
          titleAs="h3"
          title={selected.name}
          titleClass="font-semibold text-[18px] pb-[6px]"
          label={type.toUpperCase()}
        />
      </div>

      {/* SKILL PICKER */}
      <div
        role="group"
        aria-label={`${type} skills`}
        className="relative h-[240px] overflow-hidden rounded-[20px] border border-bBORDERFADE bg-bFRAME p-2 [mask-image:linear-gradient(to_bottom,transparent,#000_10%,#000_90%,transparent)]"
      >
        <Marquee
          vertical
          pauseOnHover
          repeat={skills.length < 4 ? 4 : 2}
          className="h-full p-0 [--gap:0.5rem]"
          style={{ "--duration": `${Math.max(skills.length * 1.2, 4)}s` } as React.CSSProperties}
        >
          {skills.map((skill) => {
            const isSelected = skill.name === selected.name;

            return (
              <button
                key={skill.name}
                type="button"
                aria-pressed={isSelected}
                aria-label={skill.name}
                title={skill.name}
                onClick={() => setSelectedName(skill.name)}
                style={skillVars(skill)}
                className={cn(
                  "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[12px] transition-colors",
                  colorClass,
                  isSelected ? tintClass : "bg-bCHIP hover:bg-bPLACEHOLDER"
                )}
              >
                <SkillIcon skill={skill} size={28} />
              </button>
            );
          })}
        </Marquee>
      </div>
    </div>
  );
};

export default SkillGroupCard;
