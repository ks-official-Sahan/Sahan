import "server-only";

import { z } from "zod";

import { isSafeHref } from "@/lib/cms/href";
import type { Project, ProjectCategory, ProjectLinkKind, ProjectPlatform, ProjectStatus } from "@/types/project";

// Link validation: kind, url (must be safe and HTTPS for external), optional label.
export const projectLinkSchema = z.object({
  kind: z.enum(["website", "webapp", "playstore", "appstore", "demo", "casestudy", "facebook"] as const),
  url: z.string().refine((url) => isSafeHref(url), "Invalid or unsafe URL"),
  label: z.string().optional(),
});

export const projectImageSchema = z
  .object({
    src: z.string().refine((src) => isSafeHref(src), "Invalid image URL"),
    alt: z.string().min(1, "Alt text is required"),
    fit: z.enum(["cover", "contain"]).optional(),
    background: z.string().optional(),
    position: z.string().optional(),
    mediaId: z.string().optional(), // Seam: set by media step 13
  })
  .nullable();

export const projectSchema = z.object({
  id: z.string(),
  slug: z.string().min(1),
  title: z.string().min(1),
  tagline: z.string(),
  description: z.string(),
  role: z.string().min(1),
  organization: z.string().nullable().optional(),
  organizationUrl: z.string().url().nullable().optional(),
  category: z.enum(["product", "freelance", "contract", "internship", "internal"] as const),
  status: z.enum(["live", "demo", "upcoming", "unpublished", "offline", "private"] as const),
  platforms: z.array(z.enum(["android", "ios", "web", "web-admin"] as const)).default([]),
  tech: z.array(z.string()).default([]),
  links: z.array(projectLinkSchema).default([]),
  image: projectImageSchema,
  year: z.string(),
  featured: z.boolean().default(false),
  sortOrder: z.number().default(0),
  published: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type ProjectRow = z.infer<typeof projectSchema>;

export async function loadProjects(client: { project: { findMany: (arg: any) => Promise<any[]> } }): Promise<Project[]> {
  const rows = (await client.project.findMany({
    where: { published: true },
    orderBy: { sortOrder: "asc" },
  })) as Array<ProjectRow>;

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    role: row.role,
    organization: row.organization ?? undefined,
    organizationUrl: row.organizationUrl ?? undefined,
    category: row.category as ProjectCategory,
    status: row.status as ProjectStatus,
    platforms: row.platforms as ProjectPlatform[],
    tech: row.tech,
    links: row.links,
    image: row.image || undefined,
    year: row.year,
    featured: row.featured,
  }));
}
