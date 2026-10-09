import "server-only";

import { cached } from "@/lib/cache/cached";
import { loadOrNull } from "@/lib/cache/fallback";
import { TAGS } from "@/lib/cache/tags";
import { repos } from "@/lib/data";
import { log } from "@/lib/log";
import type { Project } from "@/types/project";
import type { ExperienceEntry } from "@/types/experience";
import type { ServiceCategory } from "@/types/service";
import type { Skill, SkillCategory } from "@/types/skills";

import { loadProjects, projectSchema, type ProjectRow } from "./projects";
import { loadExperience, experienceSchema, type ExperienceRow } from "./experience";
import { serviceGroupSchema, type PublicServiceGroup } from "./services";
import { skillGroupSchema, type PublicSkillGroup } from "./skills";

export type { PublicService, PublicServiceGroup, ServiceDone } from "./services";
export type { PublicSkill, PublicSkillGroup } from "./skills";

// Public reads of collections (projects, experience, services, skills).
// Each loads from the database when configured, or from code defaults when not.
// No collection has an optional unpublished draft: only published items are loaded.

// ─── Projects ────────────────────────────────────────────────────────────────

async function readProjects(): Promise<ProjectRow[]> {
  const rows = await repos.projects.listPublished();
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

  if (stored === null) return defaults;

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
  const rows = await repos.experiences.listPublished();
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

  if (stored === null) return defaults;

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

async function readServices() {
  return repos.serviceGroups.listPublished();
}

/** Returns null only when storage is unavailable; an empty stored collection stays empty. */
export async function getPublishedServices(): Promise<PublicServiceGroup[] | null> {
  const stored = await loadOrNull(
    cached(readServices, ["collections", "services"], {
      tags: [TAGS.collection("services")],
      revalidate: 3600,
    }),
    { onError: (error) => log.warn("services read failed; using code defaults", { error: String(error) }) }
  );

  if (stored === null) return null;
  return stored.flatMap((row) => {
    const parsed = serviceGroupSchema.safeParse(row);
    if (!parsed.success) {
      log.warn("invalid service group ignored", { id: row.id, error: parsed.error.message });
      return [];
    }
    return [parsed.data];
  });
}

export async function getServices(): Promise<ServiceCategory[] | null> {
  const groups = await getPublishedServices();
  if (groups === null) return null;
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    services: group.services.map((service) => ({
      id: service.key,
      iconKey: service.iconKey,
      name: service.name,
      description: service.description,
      done: service.done ?? undefined,
    })),
  }));
}

async function readSkills() {
  return repos.skillGroups.listPublished();
}

/** Returns null only when storage is unavailable; an empty stored collection stays empty. */
export async function getPublishedSkills(): Promise<PublicSkillGroup[] | null> {
  const stored = await loadOrNull(
    cached(readSkills, ["collections", "skills"], {
      tags: [TAGS.collection("skills")],
      revalidate: 3600,
    }),
    { onError: (error) => log.warn("skills read failed; using code defaults", { error: String(error) }) }
  );

  if (stored === null) return null;
  return stored.flatMap((row) => {
    const parsed = skillGroupSchema.safeParse(row);
    if (!parsed.success) {
      log.warn("invalid skill group ignored", { id: row.id, error: parsed.error.message });
      return [];
    }
    return [parsed.data];
  });
}

export async function getSkills(): Promise<SkillCategory[] | null> {
  const groups = await getPublishedSkills();
  if (groups === null) return null;
  return groups.map((group) => ({
    id: group.key,
    category: group.label,
    skills: group.skills.map((skill): Skill => {
      const base = {
        name: skill.name,
        abbr: skill.abbr,
        type: skill.type,
        baseColor: { light: skill.colorLight, dark: skill.colorDark },
        iconKey: skill.iconKey,
      };
      return skill.variant === "stroke" ? { ...base, variant: "stroke" } : { ...base, variant: "fill" };
    }),
  }));
}
