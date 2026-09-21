import ChipMarquee from "@/components/common/ChipMarquee";
import SkillChip from "@/components/common/SkillChip";
import HomeSection from "@/components/home/HomeSection";
import SectionHeading from "@/components/home/SectionHeading";
import { HomeContent } from "@/contents/home";
import { MySkills } from "@/contents/skills";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import React from "react";

// Working-style skills live on the About page; the home toolbox is the stack.
const softCategories = ["General Skills", "Mentoring Skills"];
const stackCategories = MySkills.tabs.categories.filter(
  (category) => !softCategories.includes(category.category)
);

// Each row is a category label plus a slow marquee of its tools, alternating
// direction so the block reads as woven rather than as one long ticker. The
// marquee stops on hover; reduced-motion visitors get wrapped chips instead.
const ToolboxSection = () => {
  const { home } = HomeContent;

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

      <div className="reveal mt-10 divide-y divide-bBORDERFADE overflow-hidden rounded-[16px] border border-bBORDERFADE bg-bCARD">
        {stackCategories.map((category, index) => (
          <div
            key={category.id}
            className="grid grid-cols-1 items-center gap-3 px-5 py-5 lg:grid-cols-[180px_1fr] lg:gap-8 lg:px-8"
          >
            <h3 className="text-sm font-semibold opacity-80">
              {category.category}
            </h3>
            <ChipMarquee
              label={`${category.category} skills`}
              reverse={index % 2 === 1}
              duration={28 + (index % 3) * 6}
              minItems={8}
              className="min-w-0"
            >
              {category.skills.map((skill) => (
                <SkillChip key={skill.name} skill={skill} />
              ))}
            </ChipMarquee>
          </div>
        ))}
      </div>
    </HomeSection>
  );
};

export default ToolboxSection;
