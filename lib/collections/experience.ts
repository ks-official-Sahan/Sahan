import "server-only";

import { z } from "zod";

import type { ExperienceEntry, EmploymentType } from "@/types/experience";

export const experienceSchema = z.object({
  id: z.string(),
  company: z.string().min(1),
  companyUrl: z.string().url().optional(),
  role: z.string().min(1),
  period: z.string().min(1),
  type: z.enum(["full-time", "contract", "part-time", "internship", "freelance"] as const),
  location: z.string().optional(),
  highlights: z.array(z.string()).default([]),
  current: z.boolean().default(false),
  sortOrder: z.number().default(0),
  published: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ExperienceRow = z.infer<typeof experienceSchema>;

export async function loadExperience(client: { experience: { findMany: (arg: any) => Promise<any[]> } }): Promise<ExperienceEntry[]> {
  const rows = (await client.experience.findMany({
    where: { published: true },
    orderBy: { sortOrder: "asc" },
  })) as Array<ExperienceRow>;

  return rows.map((row) => ({
    company: row.company,
    companyUrl: row.companyUrl,
    role: row.role,
    period: row.period,
    type: row.type as EmploymentType,
    location: row.location,
    highlights: row.highlights,
    current: row.current,
  }));
}
