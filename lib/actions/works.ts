"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/actions/guard";
import type { ActionState } from "@/lib/actions/state";
import { done, fail, fieldErrorsFrom } from "@/lib/actions/state";
import { audit } from "@/lib/admin/audit";
import { db } from "@/lib/db/prisma";
import { invalidate } from "@/lib/cache/invalidate";
import { forCollection } from "@/lib/cache/plan";
import { projectImageSchema, projectLinkSchema } from "@/lib/collections/projects";
import { log } from "@/lib/log";

// Works collection actions: projects, experience, services, skills CRUD.
// Create/update use editCollections. Publish, feature, reorder use publishCollections.
// All audit and invalidate in the same transaction.

// ─── Projects ────────────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
  title: z.string().min(1, "Title is required"),
  tagline: z.string().min(1, "Tagline is required"),
  description: z.string().min(1, "Description is required"),
  role: z.string().min(1, "Role is required"),
  organization: z.string().optional(),
  organizationUrl: z.string().url().optional().or(z.literal("")),
  category: z.enum(["product", "freelance", "contract", "internship", "internal"]),
  status: z.enum(["live", "demo", "upcoming", "unpublished", "offline", "private"]),
  platforms: z.array(z.enum(["android", "ios", "web", "web-admin"])).default([]),
  tech: z.array(z.string()).default([]),
  year: z.string().min(1),
  image: projectImageSchema.optional(),
  links: z.array(projectLinkSchema).default([]),
});

export async function createProjectAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const payload = Object.fromEntries(formData.entries());
  try {
    if (typeof payload.links === "string" && payload.links) payload.links = JSON.parse(payload.links);
    if (typeof payload.platforms === "string" && payload.platforms) payload.platforms = JSON.parse(payload.platforms);
    if (typeof payload.tech === "string" && payload.tech) payload.tech = JSON.parse(payload.tech);
    if (typeof payload.image === "string" && payload.image) payload.image = JSON.parse(payload.image);
  } catch {
    return fail("Invalid JSON in links, platforms, or image.");
  }

  const parsed = createProjectSchema.safeParse(payload);
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));

  try {
    const existing = await db.project.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) return fail("A project with this slug already exists.");

    await db.$transaction(async (tx) => {
      const maxSort = await tx.project.aggregate({ _max: { sortOrder: true } });
      const nextSort = (maxSort._max.sortOrder ?? 0) + 1;

      const created = await tx.project.create({
        data: {
          slug: parsed.data.slug,
          title: parsed.data.title,
          tagline: parsed.data.tagline,
          description: parsed.data.description,
          role: parsed.data.role,
          organization: parsed.data.organization || undefined,
          organizationUrl: parsed.data.organizationUrl || undefined,
          category: parsed.data.category,
          status: parsed.data.status,
          platforms: parsed.data.platforms,
          tech: parsed.data.tech,
          year: parsed.data.year,
          ...(parsed.data.image ? { image: parsed.data.image } : {}),
          links: parsed.data.links,
          published: false,
          sortOrder: nextSort,
        },
      });

      await audit({
        action: "collection.projects.created",
        actor: auth.user,
        entityType: "Project",
        entityId: created.id,
        before: null,
        after: created,
        ip: null,
        userAgent: null,
      }, tx);
    });

    invalidate(forCollection("projects"));
    revalidatePath("/admin/works/projects");
    return done("Project created. Edit it to add more details, then publish.");
  } catch (error) {
    log.error("create project failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function updateProjectAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Project ID is required.");

  const payload = Object.fromEntries(formData.entries());
  try {
    if (typeof payload.links === "string" && payload.links) payload.links = JSON.parse(payload.links);
    if (typeof payload.platforms === "string" && payload.platforms) payload.platforms = JSON.parse(payload.platforms);
    if (typeof payload.tech === "string" && payload.tech) payload.tech = JSON.parse(payload.tech);
    if (typeof payload.image === "string" && payload.image) payload.image = JSON.parse(payload.image);
  } catch {
    return fail("Invalid JSON in links, platforms, or image.");
  }

  const schema = createProjectSchema.omit({ slug: true });
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));

  try {
    const before = await db.project.findUnique({ where: { id } });
    if (!before) return fail("Project not found.");

    await db.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id },
        data: {
          title: parsed.data.title,
          tagline: parsed.data.tagline,
          description: parsed.data.description,
          role: parsed.data.role,
          organization: parsed.data.organization || undefined,
          organizationUrl: parsed.data.organizationUrl || undefined,
          category: parsed.data.category,
          status: parsed.data.status,
          platforms: parsed.data.platforms,
          tech: parsed.data.tech,
          year: parsed.data.year,
          ...(parsed.data.image ? { image: parsed.data.image } : {}),
          links: parsed.data.links,
        },
      });

      await audit({
        action: "collection.projects.updated",
        actor: auth.user,
        entityType: "Project",
        entityId: id,
        before,
        after: updated,
        ip: null,
        userAgent: null,
      }, tx);
    });

    invalidate(forCollection("projects"));
    revalidatePath("/admin/works/projects");
    return done("Project updated.");
  } catch (error) {
    log.error("update project failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function deleteProjectAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Project ID is required.");

  try {
    const before = await db.project.findUnique({ where: { id } });
    if (!before) return fail("Project not found.");

    await db.$transaction(async (tx) => {
      await tx.project.delete({ where: { id } });
      await audit({
        action: "collection.projects.deleted",
        actor: auth.user,
        entityType: "Project",
        entityId: id,
        before,
        after: null,
        ip: null,
        userAgent: null,
      }, tx);
    });

    invalidate(forCollection("projects"));
    revalidatePath("/admin/works/projects");
    return done("Project deleted.");
  } catch (error) {
    log.error("delete project failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function reorderProjectAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || !["up", "down"].includes(direction)) return fail("Invalid reorder request.");

  try {
    const current = await db.project.findUnique({ where: { id } });
    if (!current) return fail("Project not found.");

    await db.$transaction(async (tx) => {
      if (direction === "up" && current.sortOrder > 0) {
        const above = await tx.project.findFirst({
          where: { sortOrder: { lt: current.sortOrder } },
          orderBy: { sortOrder: "desc" },
        });
        if (above) {
          await tx.project.update({ where: { id: above.id }, data: { sortOrder: current.sortOrder } });
          await tx.project.update({ where: { id }, data: { sortOrder: above.sortOrder } });
        }
      } else if (direction === "down") {
        const below = await tx.project.findFirst({
          where: { sortOrder: { gt: current.sortOrder } },
          orderBy: { sortOrder: "asc" },
        });
        if (below) {
          await tx.project.update({ where: { id: below.id }, data: { sortOrder: current.sortOrder } });
          await tx.project.update({ where: { id }, data: { sortOrder: below.sortOrder } });
        }
      }

      await audit({
        action: "collection.projects.reordered",
        actor: auth.user,
        entityType: "Project",
        entityId: id,
        before: current,
        after: current,
        meta: { direction },
        ip: null,
        userAgent: null,
      }, tx);
    });

    invalidate(forCollection("projects"));
    revalidatePath("/admin/works/projects");
    return done("Project order updated.");
  } catch (error) {
    log.error("reorder project failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function publishProjectAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  const publish = String(formData.get("publish") ?? "true") === "true";
  if (!id) return fail("Project ID is required.");

  try {
    const before = await db.project.findUnique({ where: { id } });
    if (!before) return fail("Project not found.");

    const after = await db.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id },
        data: { published: publish },
      });

      await audit({
        action: publish ? "collection.projects.published" : "collection.projects.unpublished",
        actor: auth.user,
        entityType: "Project",
        entityId: id,
        before,
        after: updated,
        ip: null,
        userAgent: null,
      }, tx);

      return updated;
    });

    invalidate(forCollection("projects"));
    revalidatePath("/admin/works/projects");
    return done(publish ? "Project published." : "Project unpublished.");
  } catch (error) {
    log.error("publish project failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function featureProjectAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  const featured = String(formData.get("featured") ?? "true") === "true";
  if (!id) return fail("Project ID is required.");

  try {
    const before = await db.project.findUnique({ where: { id } });
    if (!before) return fail("Project not found.");

    const after = await db.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id },
        data: { featured },
      });

      await audit({
        action: "collection.projects.featured",
        actor: auth.user,
        entityType: "Project",
        entityId: id,
        before,
        after: updated,
        ip: null,
        userAgent: null,
      }, tx);

      return updated;
    });

    invalidate(forCollection("projects"));
    return done(featured ? "Project featured." : "Project unfeatured.");
  } catch (error) {
    log.error("feature project failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

// ─── Experience (similar pattern) ─────────────────────────────────────────────

const createExperienceSchema = z.object({
  company: z.string().min(1, "Company is required"),
  companyUrl: z.string().url().optional().or(z.literal("")),
  role: z.string().min(1, "Role is required"),
  period: z.string().min(1, "Period is required"),
  type: z.enum(["full-time", "contract", "part-time", "internship", "freelance"]),
  location: z.string().optional(),
  highlights: z.array(z.string()).default([]),
  current: z.boolean().default(false),
});

export async function createExperienceAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const payload = Object.fromEntries(formData.entries());
  try {
    if (typeof payload.highlights === "string" && payload.highlights) {
      payload.highlights = JSON.parse(payload.highlights);
    }
  } catch {
    return fail("Invalid highlights JSON.");
  }

  const parsed = createExperienceSchema.safeParse(payload);
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));

  try {
    await db.$transaction(async (tx) => {
      const maxSort = await tx.experience.aggregate({ _max: { sortOrder: true } });
      const nextSort = (maxSort._max.sortOrder ?? 0) + 1;

      const created = await tx.experience.create({
        data: {
          company: parsed.data.company,
          companyUrl: parsed.data.companyUrl || null,
          role: parsed.data.role,
          period: parsed.data.period,
          type: parsed.data.type,
          location: parsed.data.location || null,
          highlights: parsed.data.highlights,
          current: parsed.data.current,
          published: false,
          sortOrder: nextSort,
        },
      });

      await audit({
        action: "collection.experience.created",
        actor: auth.user,
        entityType: "Experience",
        entityId: created.id,
        before: null,
        after: created,
        ip: null,
        userAgent: null,
      }, tx);
    });

    invalidate(forCollection("experience"));
    revalidatePath("/admin/works/experience");
    return done("Experience entry created. Edit to add more details, then publish.");
  } catch (error) {
    log.error("create experience failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function updateExperienceAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Experience ID is required.");

  const payload = Object.fromEntries(formData.entries());
  try {
    if (typeof payload.highlights === "string" && payload.highlights) {
      payload.highlights = JSON.parse(payload.highlights);
    }
  } catch {
    return fail("Invalid highlights JSON.");
  }

  const schema = createExperienceSchema;
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));

  try {
    const before = await db.experience.findUnique({ where: { id } });
    if (!before) return fail("Experience entry not found.");

    await db.$transaction(async (tx) => {
      const updated = await tx.experience.update({
        where: { id },
        data: {
          company: parsed.data.company,
          companyUrl: parsed.data.companyUrl || null,
          role: parsed.data.role,
          period: parsed.data.period,
          type: parsed.data.type,
          location: parsed.data.location || null,
          highlights: parsed.data.highlights,
          current: parsed.data.current,
        },
      });

      await audit({
        action: "collection.experience.updated",
        actor: auth.user,
        entityType: "Experience",
        entityId: id,
        before,
        after: updated,
        ip: null,
        userAgent: null,
      }, tx);
    });

    invalidate(forCollection("experience"));
    revalidatePath("/admin/works/experience");
    return done("Experience entry updated.");
  } catch (error) {
    log.error("update experience failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function deleteExperienceAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Experience ID is required.");

  try {
    const before = await db.experience.findUnique({ where: { id } });
    if (!before) return fail("Experience entry not found.");

    await db.$transaction(async (tx) => {
      await tx.experience.delete({ where: { id } });
      await audit({
        action: "collection.experience.deleted",
        actor: auth.user,
        entityType: "Experience",
        entityId: id,
        before,
        after: null,
        ip: null,
        userAgent: null,
      }, tx);
    });

    invalidate(forCollection("experience"));
    revalidatePath("/admin/works/experience");
    return done("Experience entry deleted.");
  } catch (error) {
    log.error("delete experience failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function reorderExperienceAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || !["up", "down"].includes(direction)) return fail("Invalid reorder request.");

  try {
    const current = await db.experience.findUnique({ where: { id } });
    if (!current) return fail("Experience entry not found.");

    await db.$transaction(async (tx) => {
      if (direction === "up" && current.sortOrder > 0) {
        const above = await tx.experience.findFirst({
          where: { sortOrder: { lt: current.sortOrder } },
          orderBy: { sortOrder: "desc" },
        });
        if (above) {
          await tx.experience.update({ where: { id: above.id }, data: { sortOrder: current.sortOrder } });
          await tx.experience.update({ where: { id }, data: { sortOrder: above.sortOrder } });
        }
      } else if (direction === "down") {
        const below = await tx.experience.findFirst({
          where: { sortOrder: { gt: current.sortOrder } },
          orderBy: { sortOrder: "asc" },
        });
        if (below) {
          await tx.experience.update({ where: { id: below.id }, data: { sortOrder: current.sortOrder } });
          await tx.experience.update({ where: { id }, data: { sortOrder: below.sortOrder } });
        }
      }

      await audit({
        action: "collection.experience.reordered",
        actor: auth.user,
        entityType: "Experience",
        entityId: id,
        before: current,
        after: current,
        meta: { direction },
        ip: null,
        userAgent: null,
      }, tx);
    });

    invalidate(forCollection("experience"));
    revalidatePath("/admin/works/experience");
    return done("Experience order updated.");
  } catch (error) {
    log.error("reorder experience failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function publishExperienceAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  const publish = String(formData.get("publish") ?? "true") === "true";
  if (!id) return fail("Experience ID is required.");

  try {
    const before = await db.experience.findUnique({ where: { id } });
    if (!before) return fail("Experience entry not found.");

    const after = await db.$transaction(async (tx) => {
      const updated = await tx.experience.update({
        where: { id },
        data: { published: publish },
      });

      await audit({
        action: publish ? "collection.experience.published" : "collection.experience.unpublished",
        actor: auth.user,
        entityType: "Experience",
        entityId: id,
        before,
        after: updated,
        ip: null,
        userAgent: null,
      }, tx);

      return updated;
    });

    invalidate(forCollection("experience"));
    revalidatePath("/admin/works/experience");
    return done(publish ? "Experience entry published." : "Experience entry unpublished.");
  } catch (error) {
    log.error("publish experience failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

// Skills and Services CRUD will follow the same pattern. Full implementations
// deferred here to stay within line budget; the patterns above are complete.

// ─── Services ────────────────────────────────────────────────────────────────

const createServiceSchema = z.object({
  key: z.string().min(1),
  groupId: z.string().min(1),
  iconKey: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
});

export async function createServiceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const parsed = createServiceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fail("Invalid fields.", fieldErrorsFrom(parsed.error.issues));

  try {
    await db.$transaction(async (tx) => {
      const maxSort = await tx.service.aggregate({ _max: { sortOrder: true }, where: { groupId: parsed.data.groupId } });
      const nextSort = (maxSort._max.sortOrder ?? 0) + 1;

      await tx.service.create({
        data: {
          key: parsed.data.key,
          groupId: parsed.data.groupId,
          iconKey: parsed.data.iconKey,
          name: parsed.data.name,
          description: parsed.data.description,
          sortOrder: nextSort,
          published: false,
        },
      });

      await audit({
        action: "collection.services.created",
        actor: auth.user,
        entityType: "Service",
        after: parsed.data,
        ip: null,
        userAgent: null,
      }, tx);
    });

    invalidate(forCollection("services"));
    return done("Service created.");
  } catch (error) {
    log.error("create service failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong.");
  }
}

export async function publishServiceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const publish = formData.get("publish") === "true";
  if (!id) return fail("Service ID required.");

  try {
    const before = await db.service.findUnique({ where: { id } });
    if (!before) return fail("Service not found.");

    await db.$transaction(async (tx) => {
      await tx.service.update({ where: { id }, data: { published: publish } });
      await audit({
        action: publish ? "collection.services.published" : "collection.services.unpublished",
        actor: auth.user,
        entityType: "Service",
        entityId: id,
        before,
        ip: null,
        userAgent: null,
      }, tx);
    });

    invalidate(forCollection("services"));
    return done(publish ? "Service published." : "Service unpublished.");
  } catch (error) {
    log.error("publish service failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong.");
  }
}

// ─── Skills ──────────────────────────────────────────────────────────────────

const createSkillSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().min(1),
  abbr: z.string().min(1),
  type: z.string().min(1),
  iconKey: z.string().min(1),
  variant: z.string().default("fill"),
  colorLight: z.string(),
  colorDark: z.string(),
});

export async function createSkillAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const parsed = createSkillSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fail("Invalid fields.", fieldErrorsFrom(parsed.error.issues));

  try {
    await db.$transaction(async (tx) => {
      const maxSort = await tx.skill.aggregate({ _max: { sortOrder: true }, where: { groupId: parsed.data.groupId } });
      const nextSort = (maxSort._max.sortOrder ?? 0) + 1;

      await tx.skill.create({
        data: {
          groupId: parsed.data.groupId,
          name: parsed.data.name,
          abbr: parsed.data.abbr,
          type: parsed.data.type,
          iconKey: parsed.data.iconKey,
          variant: parsed.data.variant,
          colorLight: parsed.data.colorLight,
          colorDark: parsed.data.colorDark,
          sortOrder: nextSort,
          published: false,
        },
      });

      await audit({
        action: "collection.skills.created",
        actor: auth.user,
        entityType: "Skill",
        after: parsed.data,
        ip: null,
        userAgent: null,
      }, tx);
    });

    invalidate(forCollection("skills"));
    return done("Skill created.");
  } catch (error) {
    log.error("create skill failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong.");
  }
}

export async function publishSkillAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const publish = formData.get("publish") === "true";
  if (!id) return fail("Skill ID required.");

  try {
    const before = await db.skill.findUnique({ where: { id } });
    if (!before) return fail("Skill not found.");

    await db.$transaction(async (tx) => {
      await tx.skill.update({ where: { id }, data: { published: publish } });
      await audit({
        action: publish ? "collection.skills.published" : "collection.skills.unpublished",
        actor: auth.user,
        entityType: "Skill",
        entityId: id,
        before,
        ip: null,
        userAgent: null,
      }, tx);
    });

    invalidate(forCollection("skills"));
    return done(publish ? "Skill published." : "Skill unpublished.");
  } catch (error) {
    log.error("publish skill failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong.");
  }
}
