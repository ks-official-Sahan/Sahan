// Custom SVG icons take `IconProps`; Tabler icons are stroke-based and take
// `size`/`color`. `variant` discriminates which rendering path an icon needs.
import type { JSX } from "react";

interface SkillBase {
  name: string;
  abbr: string;
  /** Sub-group label shown inside a category (e.g. "frontend", "database"). */
  type: string;
  baseColor: { light: string; dark: string };
}

export interface FillSkill extends SkillBase {
  variant?: "fill";
  icon: (props: IconProps) => JSX.Element;
}

export interface StrokeSkill extends SkillBase {
  variant: "stroke";
  // `@tabler/icons-react` is declared as an untyped module in this project.
  icon: (props: {
    size?: number;
    color?: string;
    stroke?: number;
    className?: string;
  }) => JSX.Element;
}

export type Skill = FillSkill | StrokeSkill;

export interface SkillCategory {
  id: string;
  category: string;
  skills: Skill[];
}
