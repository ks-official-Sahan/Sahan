import "server-only";

import { cached } from "@/lib/cache/cached";
import { loadOrNull } from "@/lib/cache/fallback";
import { TAGS } from "@/lib/cache/tags";
import { db } from "@/lib/db/prisma";
import { log } from "@/lib/log";
import type { Project } from "@/types/project";
import type { ExperienceEntry } from "@/types/experience";

import { loadProjects, projectSchema, type ProjectRow } from "./projects";
import { loadExperience, experienceSchema, type ExperienceRow } from "./experience";

// Public reads of collections (projects, experience, services, skills).
// Each loads from the database when configured, or from code defaults when not.
// No collection has an optional unpublished draft: only published items are loaded.

// ─── Projects ────────────────────────────────────────────────────────────────

async function readProjects(): Promise<ProjectRow[]> {
  const rows = await db.project.findMany({
    where: { published: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      tagline: true,
      description: true,
      role: true,
      organization: true,
      organizationUrl: true,
      category: true,
      status: true,
      platforms: true,
      tech: true,
      links: true,
      image: true,
      year: true,
      featured: true,
      sortOrder: true,
      published: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    links: (row.links as any[]) || [],
    image: row.image || null,
  })) as ProjectRow[];
}

export async function getProjects(defaults: Project[]): Promise<Project[]> {
  const stored = await loadOrNull(
    cached(readProjects, ["collections", "projects"], {
      tags: [TAGS.collection("projects")],
      revalidate: 3600,
    }),
    {
      onError: (error) =>
        log.warn("projects read failed during build, using defaults", {
          error: String(error),
        }),
    }
  );

  if (!stored) return defaults;

  const validated = stored
    .map((row: any) => {
      const parsed = projectSchema.safeParse(row);
      if (!parsed.success) {
        log.warn("invalid project row ignored", { id: row.id, error: parsed.error.message });
        return null;
      }
      return parsed.data;
    })
    .filter((x: any): x is ProjectRow => x !== null);

  return loadProjects({ project: { findMany: async () => validated } });
}

// ─── Experience ──────────────────────────────────────────────────────────────

async function readExperience(): Promise<ExperienceRow[]> {
  const rows = await db.experience.findMany({
    where: { published: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      company: true,
      companyUrl: true,
      role: true,
      period: true,
      type: true,
      location: true,
      highlights: true,
      current: true,
      sortOrder: true,
      published: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows as ExperienceRow[];
}

export async function getExperience(defaults: ExperienceEntry[]): Promise<ExperienceEntry[]> {
  const stored = await loadOrNull(
    cached(readExperience, ["collections", "experience"], {
      tags: [TAGS.collection("experience")],
      revalidate: 3600,
    }),
    {
      onError: (error) =>
        log.warn("experience read failed during build, using defaults", {
          error: String(error),
        }),
    }
  );

  if (!stored) return defaults;

  const validated = stored
    .map((row: any) => {
      const parsed = experienceSchema.safeParse(row);
      if (!parsed.success) {
        log.warn("invalid experience row ignored", { id: row.id, error: parsed.error.message });
        return null;
      }
      return parsed.data;
    })
    .filter((x: any): x is ExperienceRow => x !== null);

  return loadExperience({ experience: { findMany: async () => validated } });
}
