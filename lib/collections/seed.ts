import "server-only";

import type { Prisma } from "@prisma/client";

import type { Project } from "@/types/project";
import type { ExperienceEntry } from "@/types/experience";

// Idempotent seed for collections: only fills empty tables. Imported by
// prisma/seed-collections.ts and run once per deployment. Collections stay
// separate from the CMS because they are real CRUD data (with reordering and
// publishing), not versioned page sections.

export async function seedProjects(tx: Prisma.TransactionClient, defaults: Project[]): Promise<void> {
  const existing = await tx.project.count();
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

  await tx.project.createMany({ data: items });
}

export async function seedExperience(tx: Prisma.TransactionClient, defaults: ExperienceEntry[]): Promise<void> {
  const existing = await tx.experience.count();
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

  await tx.experience.createMany({ data: items });
}

// Services and skills seeds will be created when their full CRUD is built.
