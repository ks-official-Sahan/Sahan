import {
  IconBrandAzure,
  IconBrandCloudflare,
  IconBrandDjango,
  IconBrandDocker,
  IconBrandFigma,
  IconBrandFirebase,
  IconBrandGraphql,
  IconBrandPrisma,
  IconBrandRedux,
  IconBrandSupabase,
  IconBrandVercel,
} from "@tabler/icons-react";
import { Code2 } from "lucide-react";

import MaskIcon from "@/components/common/MaskIcon";
import type { Skill } from "@/types/skills";

type StrokeIcon = NonNullable<Skill["icon"]>;

// No prototype: a CMS iconKey such as "constructor" must not resolve to an
// Object.prototype member and crash rendering.
const strokeIcons: Record<string, StrokeIcon | undefined> = Object.assign(Object.create(null), {
  IconBrandAzure: IconBrandAzure as StrokeIcon,
  IconBrandCloudflare: IconBrandCloudflare as StrokeIcon,
  IconBrandDjango: IconBrandDjango as StrokeIcon,
  IconBrandDocker: IconBrandDocker as StrokeIcon,
  IconBrandFigma: IconBrandFigma as StrokeIcon,
  IconBrandFirebase: IconBrandFirebase as StrokeIcon,
  IconBrandGraphql: IconBrandGraphql as StrokeIcon,
  IconBrandPrisma: IconBrandPrisma as StrokeIcon,
  IconBrandRedux: IconBrandRedux as StrokeIcon,
  IconBrandSupabase: IconBrandSupabase as StrokeIcon,
  IconBrandVercel: IconBrandVercel as StrokeIcon,
  azure: IconBrandAzure as StrokeIcon,
  cloudflare: IconBrandCloudflare as StrokeIcon,
  django: IconBrandDjango as StrokeIcon,
  docker: IconBrandDocker as StrokeIcon,
  figma: IconBrandFigma as StrokeIcon,
  firebase: IconBrandFirebase as StrokeIcon,
  graphql: IconBrandGraphql as StrokeIcon,
  prisma: IconBrandPrisma as StrokeIcon,
  redux: IconBrandRedux as StrokeIcon,
  supabase: IconBrandSupabase as StrokeIcon,
  vercel: IconBrandVercel as StrokeIcon,
});

const bundledSkillIcons = new Set([
  "activelistening", "adaptability", "angularjs", "aws", "bootstrap", "coaching",
  "collaboration", "communication", "cpp", "csharp", "css", "dotnet", "empathy",
  "excel", "expressjs", "feedbackdelivery", "flutter", "golang", "googleanalytics",
  "googlecloud", "html", "illustrator", "invision", "ionic", "java", "javascript",
  "jquery", "keras", "kotlin", "kubernetes", "motivation", "mongodb", "mysql", "nestjs",
  "nextjs", "nodejs", "openai", "php", "photoshop", "postgresql", "powerbi",
  "problemsolving", "pytorch", "python", "react", "rubyonrails", "rust", "sass", "sketch",
  "springboot", "sqlite", "swift", "tableau", "tailwindcss", "tensorflow", "terraform",
  "timemanagement", "typescript", "vuejs", "xamarin", "xd",
]);

function iconSource(skill: Skill): string | null {
  if (skill.iconSrc) return skill.iconSrc;
  const key = skill.iconKey?.replace(/\.svg$/i, "").toLowerCase();
  return key && bundledSkillIcons.has(key) ? `/icons/skills/${key}.svg` : null;
}

export default function SkillGlyph({ skill, size, className }: { skill: Skill; size: number; className?: string }) {
  const strokeIcon = skill.icon ?? (skill.iconKey ? strokeIcons[skill.iconKey] ?? strokeIcons[skill.iconKey.toLowerCase()] : undefined);
  if (skill.variant === "stroke" && strokeIcon) {
    const Icon = strokeIcon;
    return <Icon size={size} stroke={1.5} className={className} />;
  }

  const src = iconSource(skill);
  if (src) return <MaskIcon src={src} size={size} className={className} />;
  return <Code2 size={size} aria-hidden="true" className={className} />;
}
