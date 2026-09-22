import { z } from "zod";

// Skill group and individual skill schemas.
// SkillGroup: container with title, skills array.
// Skill: name, proficiency level, color fields for UI display.

export const skillSchema = z.object({
  id: z.string(),
  name: z.string(),
  proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
  colorLight: z.string().optional(),
  colorDark: z.string().optional(),
  sortOrder: z.number(),
  published: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const skillGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  skills: z.array(skillSchema),
  sortOrder: z.number(),
  published: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Skill = z.infer<typeof skillSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;

// Placeholder loader for skills. Full implementation deferred.
export async function loadSkills(client: any): Promise<SkillGroup[]> {
  // TODO: Implement DB loader
  return [];
}
