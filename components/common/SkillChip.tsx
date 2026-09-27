import MaskIcon from "@/components/common/MaskIcon";
import type { Skill } from "@/types/skills";
import React from "react";

// Brand colours are CSS variables (light + dark) so server and client markup
// match and Tailwind's `dark:` variant does the switching.
const skillVars = (skill: Skill) =>
  ({
    "--skill-light": skill.baseColor.light,
    "--skill-dark": skill.baseColor.dark,
  }) as React.CSSProperties;

const SkillGlyph = ({ skill, size }: { skill: Skill; size: number }) =>
  skill.variant === "stroke" ? (
    <skill.icon size={size} stroke={1.5} />
  ) : (
    <MaskIcon src={skill.iconSrc} size={size} />
  );

// One skill as a pill: brand-coloured glyph plus the name. Used inside
// marquees, so it never shrinks or wraps.
const SkillChip = ({ skill }: { skill: Skill }) => (
  <span
    style={skillVars(skill)}
    className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-bBORDERFADE bg-bCHIP py-1.5 pl-2.5 pr-3.5 text-sm"
  >
    <span
      aria-hidden="true"
      className="text-[color:var(--skill-light)] dark:text-[color:var(--skill-dark)]"
    >
      <SkillGlyph skill={skill} size={20} />
    </span>
    {skill.name}
  </span>
);

export default SkillChip;
