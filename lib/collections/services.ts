import { z } from "zod";

// Service group and individual service schemas.
// ServiceGroup: container with title, services array, optional icon.
// Service: name, optional description, metric (computed from projects or static).

export const serviceMetricSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("projects.category"), value: z.string() }),
  z.object({ kind: z.literal("projects.platform"), value: z.string() }),
  z.object({ kind: z.literal("projects.webProducts"), value: z.literal(true) }),
  z.object({ kind: z.literal("static"), count: z.number() }),
]);

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  metric: serviceMetricSchema.optional(),
  sortOrder: z.number(),
  published: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const serviceGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  services: z.array(serviceSchema),
  icon: z.string().optional(),
  sortOrder: z.number(),
  published: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ServiceMetric = z.infer<typeof serviceMetricSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type ServiceGroup = z.infer<typeof serviceGroupSchema>;

// Placeholder loader for services. Full implementation deferred.
export async function loadServices(client: any): Promise<ServiceGroup[]> {
  // TODO: Implement DB loader
  return [];
}
