import ChipMarquee from "@/components/common/ChipMarquee";
import SkillChip from "@/components/common/SkillChip";
import HomeSection from "@/components/home/HomeSection";
import SectionHeading from "@/components/home/SectionHeading";
import { MySkills } from "@/contents/skills";
import type { PageContent } from "@/lib/cms/registry";
import type { SkillCategory } from "@/types/skills";
import React from "react";

interface WorksBehindProps {
  content: PageContent<"works">;
  skillGroups?: SkillCategory[] | null;
}

// Two slow rows drifting in opposite directions. Both pause on hover, both
// fall back to wrapped chips for reduced motion.
const WorksBehind = ({ content, skillGroups }: WorksBehindProps) => {
  const { behind } = content;
  const categories = skillGroups ?? MySkills.tabs.categories;
  const allSkills = categories.flatMap((category) => category.skills);
  const byName = new Map(allSkills.map((skill) => [skill.name, skill]));
  const stack = behind.stack
    .map((name) => byName.get(name))
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));

  return (
    <HomeSection id="behind" labelledBy="behind-title" band>
      <SectionHeading
        id="behind-title"
        title={behind.title}
        description={behind.subtitle}
      />

      <div className="reveal mt-10 flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold opacity-70">
            {behind.capabilitiesLabel}
          </h3>
          <ChipMarquee label={behind.capabilitiesLabel} duration={55} minItems={6}>
            {behind.capabilities.map((item) => (
              <span
                key={item}
                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-bBORDERFADE bg-bCARD px-4 py-2 text-sm"
              >
                {item}
              </span>
            ))}
          </ChipMarquee>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold opacity-70">
            {behind.stackLabel}
          </h3>
          <ChipMarquee
            label={behind.stackLabel}
            duration={45}
            reverse
            minItems={6}
          >
            {stack.map((skill) => (
              <SkillChip key={skill.name} skill={skill} />
            ))}
          </ChipMarquee>
        </div>
      </div>
    </HomeSection>
  );
};

export default WorksBehind;
