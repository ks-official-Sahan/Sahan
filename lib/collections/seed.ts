import "server-only";

import type { Repos } from "@/lib/data/repos";

import type { Project } from "@/types/project";
import type { ExperienceEntry } from "@/types/experience";

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

// Services and skills seeds will be created when their full CRUD is built.
