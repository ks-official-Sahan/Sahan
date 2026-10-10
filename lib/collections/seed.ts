import "server-only";

import type { Repos } from "@/lib/data/repos";

import type { Project } from "@/types/project";
import type { ExperienceEntry } from "@/types/experience";
import type { ServiceCategory } from "@/types/service";
import type { SkillCategory, Skill } from "@/types/skills";

// Idempotent seed for collections: only fills empty tables. Imported by
// prisma/seed-collections.ts and run once per deployment. Collections stay
// separate from the CMS because they are real CRUD data (with reordering and
// publishing), not versioned page sections.

export async function seedProjects(tx: Pick<Repos, "projects">, defaults: Project[]): Promise<void> {
  const existing = await tx.projects.count();
  if (existing > 0) return;

  const items = defaults.map((project, index) => {
    const item: any = {
      slug: project.slug,
      title: project.title,
      tagline: project.tagline,
      description: project.description,
      role: project.role,
      organization: project.organization || undefined,
      organizationUrl: project.organizationUrl || undefined,
      category: project.category,
      status: project.status,
      platforms: project.platforms || [],
      tech: project.tech || [],
      links: project.links || [],
      year: project.year,
      featured: project.featured || false,
      sortOrder: index,
      published: true,
    };
    if (project.image) item.image = project.image;
    return item;
  });

  await tx.projects.createMany(items);
}

export async function seedExperience(tx: Pick<Repos, "experiences">, defaults: ExperienceEntry[]): Promise<void> {
  const existing = await tx.experiences.count();
  if (existing > 0) return;

  const items = defaults.map((entry, index) => ({
    company: entry.company,
    companyUrl: entry.companyUrl || null,
    role: entry.role,
    period: entry.period,
    type: entry.type,
    location: entry.location || null,
    highlights: entry.highlights || [],
    current: entry.current || false,
    sortOrder: index,
    published: true,
  }));

  await tx.experiences.createMany(items);
}

const SERVICE_ICON_KEYS: Record<string, string> = {
  WEB: "Globe", BCK: "Server", API: "Plug", APP: "Smartphone", PWA: "Layers",
  DSH: "LayoutDashboard", DSK: "Monitor", CLD: "Container", CCH: "Cloud",
  DAT: "Database", SEC: "ShieldCheck", UXD: "Palette", BRD: "PenTool",
  MCK: "Boxes", PPD: "Presentation", PVE: "Video", DWF: "FileText",
  CCI: "Lightbulb", CNS: "Compass", CRO: "SearchCode", PPS: "Code2", MNT: "GraduationCap",
};

export async function seedServices(tx: Pick<Repos, "serviceGroups" | "services">, defaults: ServiceCategory[]): Promise<void> {
  if (await tx.serviceGroups.count() > 0) return;

  for (const [groupIndex, category] of defaults.entries()) {
    const group = await tx.serviceGroups.create({ name: category.name, sortOrder: groupIndex });
    await tx.services.createMany(category.services.map((service, serviceIndex) => ({
      key: service.id,
      groupId: group.id,
      iconKey: SERVICE_ICON_KEYS[service.id] ?? "CircleHelp",
      name: service.name,
      description: service.description,
      done: service.done ?? null,
      sortOrder: serviceIndex,
      published: true,
    })));
  }
}

const SKILL_ICON_KEYS: Record<string, string> = {
  GraphQL: "IconBrandGraphql", Redux: "IconBrandRedux", Django: "IconBrandDjango",
  Figma: "IconBrandFigma", Docker: "IconBrandDocker", Azure: "IconBrandAzure",
  Vercel: "IconBrandVercel", Cloudflare: "IconBrandCloudflare", Firebase: "IconBrandFirebase",
  Prisma: "IconBrandPrisma", Supabase: "IconBrandSupabase",
};

function skillIconKey(skill: Skill): string {
  if (skill.variant === "stroke") return SKILL_ICON_KEYS[skill.name] ?? "Code2";
  const file = skill.iconSrc?.split("/").at(-1)?.replace(/\.svg$/i, "");
  return file ?? skill.name.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

export async function seedSkills(tx: Pick<Repos, "skillGroups" | "skills">, defaults: SkillCategory[]): Promise<void> {
  if (await tx.skillGroups.count() > 0) return;

  for (const [groupIndex, category] of defaults.entries()) {
    const group = await tx.skillGroups.create({ key: category.id, label: category.category, sortOrder: groupIndex });
    await tx.skills.createMany(category.skills.map((skill, skillIndex) => ({
      groupId: group.id,
      name: skill.name,
      abbr: skill.abbr,
      type: skill.type,
      iconKey: skillIconKey(skill),
      variant: skill.variant ?? "fill",
      colorLight: skill.baseColor.light,
      colorDark: skill.baseColor.dark,
      sortOrder: skillIndex,
      published: true,
    })));
  }
}
