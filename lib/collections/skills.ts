import { z } from "zod";

export const skillSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  name: z.string().min(1).max(120),
  abbr: z.string().min(1).max(32),
  type: z.string().min(1).max(80),
  iconKey: z.string().min(1).max(80),
  variant: z.enum(["fill", "stroke"]),
  colorLight: z.string().regex(/^#[\da-f]{3,8}$/i),
  colorDark: z.string().regex(/^#[\da-f]{3,8}$/i),
  grid: z.unknown().nullable().optional(),
  gridOrder: z.number().int().nullable().optional(),
});

/** Public skill fields only; unpublished rows and timestamps stay private. */
export const skillGroupSchema = z.object({
  id: z.string(),
  key: z.string().min(1),
  label: z.string().min(1),
  skills: z.array(skillSchema).max(500),
});

export type PublicSkill = z.infer<typeof skillSchema>;
export type PublicSkillGroup = z.infer<typeof skillGroupSchema>;
