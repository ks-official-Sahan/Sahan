import { z } from "zod";

import { isSafeHref } from "@/lib/cms/href";

const serviceDoneItemSchema = z.object({
  name: z.string().min(1).max(120),
  count: z.number().int().nonnegative(),
});

export const serviceDoneSchema = z.object({
  title: z.string().min(1).max(120),
  href: z.string().max(500).refine(isSafeHref, "Invalid or unsafe URL").optional(),
  list: z.array(serviceDoneItemSchema).max(20),
});

/** Public service fields only; database timestamps and draft flags stay private. */
export const serviceSchema = z.object({
  id: z.string(),
  key: z.string().min(1),
  iconKey: z.string().min(1),
  name: z.string().min(1),
  description: z.string().max(20_000),
  done: serviceDoneSchema.nullable().optional(),
});

export const serviceGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  services: z.array(serviceSchema).max(500),
});

export type ServiceDone = z.infer<typeof serviceDoneSchema>;
export type PublicService = z.infer<typeof serviceSchema>;
export type PublicServiceGroup = z.infer<typeof serviceGroupSchema>;
