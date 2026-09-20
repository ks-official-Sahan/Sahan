import HomeSection from "@/components/home/HomeSection";
import SectionHeading from "@/components/home/SectionHeading";
import { HomeContent } from "@/contents/home";
import { MySkills } from "@/contents/skills";
import type { Skill } from "@/types/skills";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import React from "react";

// Brand colours are CSS variables (light + dark) so server and client markup
// match and Tailwind's `dark:` variant does the switching.
const skillVars = (skill: Skill) =>
  ({
    "--skill-light": skill.baseColor.light,
    "--skill-dark": skill.baseColor.dark,
  }) as React.CSSProperties;

const SkillGlyph = ({ skill }: { skill: Skill }) =>
  skill.variant === "stroke" ? (
    <skill.icon size={20} stroke={1.5} />
  ) : (
    <span className="inline-flex h-5 w-5 [&>svg]:h-full [&>svg]:w-full">
      <skill.icon className="fill-current" />
    </span>
  );

const ToolboxSection = () => {
  const { home } = HomeContent;
  const categories = MySkills.tabs.categories;

  return (
    <HomeSection id="toolbox" labelledBy="toolbox-title">
      <SectionHeading
        id="toolbox-title"
        title={home.toolbox.title}
        description={home.toolbox.subtitle}
        action={
          <Link
            href="/about#skills"
            className="press arrow-nudge inline-flex min-h-11 items-center gap-2 rounded-full border border-bBORDERFADE bg-bCARD px-5 text-sm font-semibold"
          >
            All skills
            <ArrowUpRight
              size={16}
              aria-hidden="true"
              className="arrow-nudge-icon"
            />
          </Link>
        }
      />

      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {categories.map((category) => (
          <div
            key={category.id}
            className="reveal flex flex-col gap-4 rounded-[12px] border border-bBORDERFADE bg-bCARD p-6"
          >
            <h3 className="text-base font-semibold">{category.category}</h3>
            <ul className="flex flex-wrap gap-2">
              {category.skills.map((skill) => (
                <li
                  key={skill.name}
                  style={skillVars(skill)}
                  className="flex items-center gap-2 rounded-full border border-bBORDERFADE bg-bCHIP py-1.5 pl-2.5 pr-3.5 text-sm"
                >
                  <span
                    aria-hidden="true"
                    className="text-[color:var(--skill-light)] dark:text-[color:var(--skill-dark)]"
                  >
                    <SkillGlyph skill={skill} />
                  </span>
                  {skill.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </HomeSection>
  );
};

export default ToolboxSection;
