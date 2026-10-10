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

// `@tabler/icons-react` is declared as an untyped module in this project.
type StrokeIcon = (props: { size?: number; color?: string; stroke?: number; className?: string }) => JSX.Element;

/**
 * Every skill names its icon, so a variant can never render without one:
 * either the variant's own static icon (code defaults in contents/), or
 * `iconKey`, the CMS key (a bundled skill SVG name or a registered Tabler
 * icon) that components/common/SkillGlyph resolves.
 */
export type FillSkill = SkillBase & { variant?: "fill"; icon?: never } & (
    | {
        /**
         * A monochrome SVG in public/icons/skills, painted in the text colour by
         * components/common/MaskIcon. A file, not an inline component, so the logo
         * is downloaded once and cached instead of repeated in every page's HTML,
         * RSC payload and client bundle.
         */
        iconSrc: string;
        iconKey?: string;
      }
    | { iconSrc?: never; iconKey: string }
  );

export type StrokeSkill = SkillBase & { variant: "stroke"; iconSrc?: never } & (
    | { icon: StrokeIcon; iconKey?: string }
    | { icon?: never; iconKey: string }
  );

export type Skill = FillSkill | StrokeSkill;

export interface SkillCategory {
  id: string;
  category: string;
  skills: Skill[];
}
