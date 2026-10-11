"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/actions/guard";
import type { ActionState } from "@/lib/actions/state";
import { done, fail, fieldErrorsFrom } from "@/lib/actions/state";
import { audit } from "@/lib/admin/audit";
import { repos, withTx, type Repos } from "@/lib/data";
import { invalidate } from "@/lib/cache/invalidate";
import { forCollection } from "@/lib/cache/plan";
import { projectImageSchema, projectLinkSchema } from "@/lib/collections/projects";
import { decodeJsonFields } from "@/lib/forms/array-fields";
import { log } from "@/lib/log";
import { parseSubmittedUpdatedAt } from "@sahan-sac/blog-kit/concurrency";
import { SLUG_MAX_LENGTH } from "@sahan-sac/blog-kit/slug";

// Works collection actions: projects, experience, services, skills CRUD.
// Create/update use editCollections. Publish, feature, reorder use publishCollections.
// All audit and invalidate in the same transaction.

// Upper bounds for every write. Without them one save can store a multi-MB
// row, and the audit row copies it again into before/after. Reads keep the
// shared, unbounded schemas (lib/collections/projects.ts), so an old row
// longer than these still renders.
const SHORT = 200;
const TAGLINE = 300;
const LONG = 5_000;
const URL_MAX = 2_000;
const KEY = 64;
const MAX_LIST = 50;
const MAX_LINKS = 20;

// Edits are conditional on the row's updatedAt as the edit form was rendered
// with it (its hidden updatedAt field). A save that lands after the form
// opened makes the write match nothing, so it is reported instead of
// silently overwritten; a form without the field is refused, not guessed.
// Publish, feature and reorder stay unconditional: each sets one explicit
// value. ActionForm puts the typed values back after a failed save, so the
// editor can copy them before reloading.
class CollectionConflictError extends Error {}
const COLLECTION_CONFLICT_MESSAGE =
  "This entry was changed elsewhere since you opened it. Your edits are still in this form: copy what you need, then reload to see the latest version.";
const STALE_FORM_MESSAGE = "This form is out of date. Reload the page and try again.";

async function validProjectImage(image: unknown): Promise<boolean> {
  if (image === undefined || image === null) return true;
  const parsed = boundedImage.safeParse(image);
  if (!parsed.success || !parsed.data) return false;
  if (!parsed.data.mediaId) return true;
  const asset = await repos.media.find(parsed.data.mediaId);
  return asset?.kind === "IMAGE" && asset.url === parsed.data.src;
}

async function syncProjectImageUsage(tx: Pick<Repos, "media">, projectId: string, image: unknown): Promise<void> {
  await tx.media.clearUsage("Project", projectId);
  const parsed = boundedImage.safeParse(image);
  if (!parsed.success || !parsed.data?.mediaId) return;
  await tx.media.recordUsage({ mediaId: parsed.data.mediaId, entityType: "Project", entityId: projectId, field: "image" });
}

const boundedLink = projectLinkSchema.refine(
  (link) => link.url.length <= URL_MAX && (link.label?.length ?? 0) <= SHORT,
  "Link is too long"
);
const boundedImage = projectImageSchema.refine(
  (image) =>
    !image ||
    (image.src.length <= URL_MAX &&
      image.alt.length <= SHORT &&
      (image.background?.length ?? 0) <= KEY &&
      (image.position?.length ?? 0) <= KEY &&
      (image.mediaId?.length ?? 0) <= KEY),
  "Image fields are too long"
);

// ─── Projects ────────────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  slug: z.string().min(1, "Slug is required").max(SLUG_MAX_LENGTH),
  title: z.string().min(1, "Title is required").max(SHORT),
  tagline: z.string().min(1, "Tagline is required").max(TAGLINE),
  description: z.string().min(1, "Description is required").max(LONG),
  role: z.string().min(1, "Role is required").max(SHORT),
  organization: z.string().max(SHORT).optional(),
  organizationUrl: z.string().max(URL_MAX).url().optional().or(z.literal("")),
  category: z.enum(["product", "freelance", "contract", "internship", "internal"]),
  status: z.enum(["live", "demo", "upcoming", "unpublished", "offline", "private"]),
  platforms: z.array(z.enum(["android", "ios", "web", "web-admin"])).default([]),
  tech: z.array(z.string().max(KEY)).max(MAX_LIST).default([]),
  year: z.string().min(1).max(32),
  image: boundedImage.optional(),
  links: z.array(boundedLink).max(MAX_LINKS).default([]),
});

export async function createProjectAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const payload = Object.fromEntries(formData.entries());
  const decoded = decodeJsonFields(payload, ["links", "platforms", "tech", "image"]);
  if (!decoded.ok) return fail(decoded.error);

  const parsed = createProjectSchema.safeParse(payload);
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));
  if (!(await validProjectImage(parsed.data.image))) {
    return fail("Some fields need attention.", { image: "Choose an image that is still in the media library." });
  }

  try {
    const existing = await repos.projects.findBySlug(parsed.data.slug);
    if (existing) return fail("A project with this slug already exists.");

    await withTx(async (tx) => {
      const nextSort = await tx.projects.nextSortOrder();

      const created = await tx.projects.create({
        slug: parsed.data.slug,
        title: parsed.data.title,
        tagline: parsed.data.tagline,
        description: parsed.data.description,
        role: parsed.data.role,
        organization: parsed.data.organization || null,
        organizationUrl: parsed.data.organizationUrl || null,
        category: parsed.data.category,
        status: parsed.data.status,
        platforms: parsed.data.platforms,
        tech: parsed.data.tech,
        year: parsed.data.year,
        // undefined (no image field submitted) leaves the column at its
        // default; an explicit null (the field was submitted with the image
        // cleared) clears it — see ProjectImageField.
        image: parsed.data.image,
        links: parsed.data.links,
        published: false,
        sortOrder: nextSort,
      });
      await syncProjectImageUsage(tx, created.id, created.image);

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

    await invalidate(forCollection("projects"));
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
  const decoded = decodeJsonFields(payload, ["links", "platforms", "tech", "image"]);
  if (!decoded.ok) return fail(decoded.error);

  const schema = createProjectSchema.omit({ slug: true });
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));
  if (!(await validProjectImage(parsed.data.image))) {
    return fail("Some fields need attention.", { image: "Choose an image that is still in the media library." });
  }

  try {
    const before = await repos.projects.find(id);
    if (!before) return fail("Project not found.");

    const expected = parseSubmittedUpdatedAt(formData.get("updatedAt"));
    if (!expected) return fail(STALE_FORM_MESSAGE);
    await withTx(async (tx) => {
      const updated = await tx.projects.updateIfUnchanged(id, expected, {
        title: parsed.data.title,
        tagline: parsed.data.tagline,
        description: parsed.data.description,
        role: parsed.data.role,
        // null, not undefined: an emptied field must clear the column
        // (undefined would make Prisma skip it and keep the old value).
        organization: parsed.data.organization || null,
        organizationUrl: parsed.data.organizationUrl || null,
        category: parsed.data.category,
        status: parsed.data.status,
        platforms: parsed.data.platforms,
        tech: parsed.data.tech,
        year: parsed.data.year,
        // See createProjectAction: undefined vs. explicit null matters here,
        // so clearing the image actually persists instead of silently
        // leaving the old value.
        image: parsed.data.image,
        links: parsed.data.links,
      });
      if (!updated) throw new CollectionConflictError();
      await syncProjectImageUsage(tx, id, updated.image);

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

    await invalidate(forCollection("projects"));
    revalidatePath("/admin/works/projects");
    return done("Project updated.");
  } catch (error) {
    if (error instanceof CollectionConflictError) return fail(COLLECTION_CONFLICT_MESSAGE);
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
    const before = await repos.projects.find(id);
    if (!before) return fail("Project not found.");

    await withTx(async (tx) => {
      await tx.media.clearUsage("Project", id);
      await tx.trash.put([{ entityType: "Project", entityId: id, label: before.title, data: { row: before }, deletedById: auth.user.id }]);
      await tx.projects.delete(id);
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

    await invalidate(forCollection("projects"));
    revalidatePath("/admin/works/projects");
    return done("Project moved to the trash.");
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
    const current = await repos.projects.find(id);
    if (!current) return fail("Project not found.");

    await withTx(async (tx) => {
      await tx.projects.move(current, direction === "up" ? "up" : "down");

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

    await invalidate(forCollection("projects"));
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
    const before = await repos.projects.find(id);
    if (!before) return fail("Project not found.");

    const after = await withTx(async (tx) => {
      const updated = await tx.projects.update(id, { published: publish });

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

    await invalidate(forCollection("projects"));
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
    const before = await repos.projects.find(id);
    if (!before) return fail("Project not found.");

    const after = await withTx(async (tx) => {
      const updated = await tx.projects.update(id, { featured });

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

    await invalidate(forCollection("projects"));
    revalidatePath("/admin/works/projects");
    return done(featured ? "Project featured." : "Project unfeatured.");
  } catch (error) {
    log.error("feature project failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

// ─── Experience (similar pattern) ─────────────────────────────────────────────

const createExperienceSchema = z.object({
  company: z.string().min(1, "Company is required").max(SHORT),
  companyUrl: z.string().max(URL_MAX).url().optional().or(z.literal("")),
  role: z.string().min(1, "Role is required").max(SHORT),
  period: z.string().min(1, "Period is required").max(SHORT),
  type: z.enum(["full-time", "contract", "part-time", "internship", "freelance"]),
  location: z.string().max(SHORT).optional(),
  highlights: z.array(z.string().max(LONG)).max(MAX_LINKS).default([]),
  current: z.boolean().default(false),
});

export async function createExperienceAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const payload: Record<string, unknown> = Object.fromEntries(formData.entries());
  const decoded = decodeJsonFields(payload, ["highlights"]);
  if (!decoded.ok) return fail(decoded.error);
  // FormData only ever carries strings, so a checked checkbox arrives as the
  // string "true" (and an unchecked one is simply absent). z.boolean() does
  // not coerce strings, so without this the form could never actually check
  // "Current role" — every submission with it checked would fail validation.
  payload.current = payload.current === "true";

  const parsed = createExperienceSchema.safeParse(payload);
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));

  try {
    await withTx(async (tx) => {
      const nextSort = await tx.experiences.nextSortOrder();

      const created = await tx.experiences.create({
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

    await invalidate(forCollection("experience"));
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

  const payload: Record<string, unknown> = Object.fromEntries(formData.entries());
  const decoded = decodeJsonFields(payload, ["highlights"]);
  if (!decoded.ok) return fail(decoded.error);
  payload.current = payload.current === "true";

  const schema = createExperienceSchema;
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));

  try {
    const before = await repos.experiences.find(id);
    if (!before) return fail("Experience entry not found.");

    const expected = parseSubmittedUpdatedAt(formData.get("updatedAt"));
    if (!expected) return fail(STALE_FORM_MESSAGE);
    await withTx(async (tx) => {
      const updated = await tx.experiences.updateIfUnchanged(id, expected, {
        company: parsed.data.company,
        companyUrl: parsed.data.companyUrl || null,
        role: parsed.data.role,
        period: parsed.data.period,
        type: parsed.data.type,
        location: parsed.data.location || null,
        highlights: parsed.data.highlights,
        current: parsed.data.current,
      });
      if (!updated) throw new CollectionConflictError();

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

    await invalidate(forCollection("experience"));
    revalidatePath("/admin/works/experience");
    return done("Experience entry updated.");
  } catch (error) {
    if (error instanceof CollectionConflictError) return fail(COLLECTION_CONFLICT_MESSAGE);
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
    const before = await repos.experiences.find(id);
    if (!before) return fail("Experience entry not found.");

    await withTx(async (tx) => {
      await tx.trash.put([{ entityType: "Experience", entityId: id, label: `${before.role} at ${before.company}`, data: { row: before }, deletedById: auth.user.id }]);
      await tx.experiences.delete(id);
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

    await invalidate(forCollection("experience"));
    revalidatePath("/admin/works/experience");
    return done("Experience entry moved to the trash.");
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
    const current = await repos.experiences.find(id);
    if (!current) return fail("Experience entry not found.");

    await withTx(async (tx) => {
      await tx.experiences.move(current, direction === "up" ? "up" : "down");

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

    await invalidate(forCollection("experience"));
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
    const before = await repos.experiences.find(id);
    if (!before) return fail("Experience entry not found.");

    const after = await withTx(async (tx) => {
      const updated = await tx.experiences.update(id, { published: publish });

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

    await invalidate(forCollection("experience"));
    revalidatePath("/admin/works/experience");
    return done(publish ? "Experience entry published." : "Experience entry unpublished.");
  } catch (error) {
    log.error("publish experience failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

// ─── Service groups ────────────────────────────────────────────────────────

const serviceGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(SHORT),
});

export async function createServiceGroupAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const parsed = serviceGroupSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));

  try {
    const created = await withTx(async (tx) => {
      const nextSort = await tx.serviceGroups.nextSortOrder();

      const group = await tx.serviceGroups.create({ name: parsed.data.name, sortOrder: nextSort });

      await audit({
        action: "collection.services.group.created",
        actor: auth.user,
        entityType: "ServiceGroup",
        entityId: group.id,
        before: null,
        after: group,
        ip: null,
        userAgent: null,
      }, tx);

      return group;
    });

    await invalidate(forCollection("services"));
    revalidatePath("/admin/works/services");
    return done("Service group created. Add services to it below.");
  } catch (error) {
    log.error("create service group failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function updateServiceGroupAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Service group ID is required.");

  const parsed = serviceGroupSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));

  try {
    const before = await repos.serviceGroups.find(id);
    if (!before) return fail("Service group not found.");

    const expected = parseSubmittedUpdatedAt(formData.get("updatedAt"));
    if (!expected) return fail(STALE_FORM_MESSAGE);
    await withTx(async (tx) => {
      const updated = await tx.serviceGroups.updateIfUnchanged(id, expected, { name: parsed.data.name });
      if (!updated) throw new CollectionConflictError();
      await audit({
        action: "collection.services.group.updated",
        actor: auth.user,
        entityType: "ServiceGroup",
        entityId: id,
        before,
        after: updated,
        ip: null,
        userAgent: null,
      }, tx);
    });

    await invalidate(forCollection("services"));
    revalidatePath("/admin/works/services");
    revalidatePath(`/admin/works/services/${id}`);
    return done("Service group updated.");
  } catch (error) {
    if (error instanceof CollectionConflictError) return fail(COLLECTION_CONFLICT_MESSAGE);
    log.error("update service group failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function deleteServiceGroupAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Service group ID is required.");

  try {
    const before = await repos.serviceGroups.findWithServices(id);
    if (!before) return fail("Service group not found.");

    await withTx(async (tx) => {
      // Deleting a group also removes every service in it.
      await tx.serviceGroups.delete(id);
      await audit({
        action: "collection.services.group.deleted",
        actor: auth.user,
        entityType: "ServiceGroup",
        entityId: id,
        before,
        after: null,
        ip: null,
        userAgent: null,
      }, tx);
    });

    await invalidate(forCollection("services"));
    revalidatePath("/admin/works/services");
    return done("Service group deleted.");
  } catch (error) {
    log.error("delete service group failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

// ─── Services ────────────────────────────────────────────────────────────────

const createServiceSchema = z.object({
  key: z.string().min(1).max(KEY),
  groupId: z.string().min(1).max(KEY),
  iconKey: z.string().min(1).max(KEY),
  name: z.string().min(1).max(SHORT),
  description: z.string().max(LONG),
});

// The group and the unique `key` stay fixed once created (mirrors the
// project slug: shown, not editable, on the update form).
const updateServiceSchema = createServiceSchema.omit({ groupId: true, key: true });

export async function createServiceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const parsed = createServiceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fail("Invalid fields.", fieldErrorsFrom(parsed.error.issues));

  try {
    await withTx(async (tx) => {
      const nextSort = await tx.services.nextSortOrder(parsed.data.groupId);

      const created = await tx.services.create({
        key: parsed.data.key,
        groupId: parsed.data.groupId,
        iconKey: parsed.data.iconKey,
        name: parsed.data.name,
        description: parsed.data.description,
        sortOrder: nextSort,
        published: false,
      });

      await audit({
        action: "collection.services.created",
        actor: auth.user,
        entityType: "Service",
        entityId: created.id,
        before: null,
        after: created,
        ip: null,
        userAgent: null,
      }, tx);
    });

    await invalidate(forCollection("services"));
    revalidatePath("/admin/works/services");
    revalidatePath(`/admin/works/services/${parsed.data.groupId}`);
    return done("Service created.");
  } catch (error) {
    log.error("create service failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong.");
  }
}

export async function updateServiceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Service ID is required.");

  const parsed = updateServiceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));

  try {
    const before = await repos.services.find(id);
    if (!before) return fail("Service not found.");

    const expected = parseSubmittedUpdatedAt(formData.get("updatedAt"));
    if (!expected) return fail(STALE_FORM_MESSAGE);
    await withTx(async (tx) => {
      const updated = await tx.services.updateIfUnchanged(id, expected, {
        iconKey: parsed.data.iconKey,
        name: parsed.data.name,
        description: parsed.data.description,
      });
      if (!updated) throw new CollectionConflictError();

      await audit({
        action: "collection.services.updated",
        actor: auth.user,
        entityType: "Service",
        entityId: id,
        before,
        after: updated,
        ip: null,
        userAgent: null,
      }, tx);
    });

    await invalidate(forCollection("services"));
    revalidatePath("/admin/works/services");
    revalidatePath(`/admin/works/services/${before.groupId}`);
    return done("Service updated.");
  } catch (error) {
    if (error instanceof CollectionConflictError) return fail(COLLECTION_CONFLICT_MESSAGE);
    log.error("update service failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function deleteServiceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Service ID is required.");

  try {
    const before = await repos.services.find(id);
    if (!before) return fail("Service not found.");

    await withTx(async (tx) => {
      await tx.trash.put([{ entityType: "Service", entityId: id, label: before.name, data: { row: before }, deletedById: auth.user.id }]);
      await tx.services.delete(id);
      await audit({
        action: "collection.services.deleted",
        actor: auth.user,
        entityType: "Service",
        entityId: id,
        before,
        after: null,
        ip: null,
        userAgent: null,
      }, tx);
    });

    await invalidate(forCollection("services"));
    revalidatePath("/admin/works/services");
    revalidatePath(`/admin/works/services/${before.groupId}`);
    return done("Service moved to the trash.");
  } catch (error) {
    log.error("delete service failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function reorderServiceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || !["up", "down"].includes(direction)) return fail("Invalid reorder request.");

  try {
    const current = await repos.services.find(id);
    if (!current) return fail("Service not found.");

    await withTx(async (tx) => {
      await tx.services.move(current, direction === "up" ? "up" : "down");

      await audit({
        action: "collection.services.reordered",
        actor: auth.user,
        entityType: "Service",
        entityId: id,
        before: current,
        after: current,
        meta: { direction },
        ip: null,
        userAgent: null,
      }, tx);
    });

    await invalidate(forCollection("services"));
    revalidatePath(`/admin/works/services/${current.groupId}`);
    return done("Service order updated.");
  } catch (error) {
    log.error("reorder service failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function publishServiceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const publish = formData.get("publish") === "true";
  if (!id) return fail("Service ID required.");

  try {
    const before = await repos.services.find(id);
    if (!before) return fail("Service not found.");

    await withTx(async (tx) => {
      await tx.services.update(id, { published: publish });
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

    await invalidate(forCollection("services"));
    revalidatePath("/admin/works/services");
    revalidatePath(`/admin/works/services/${before.groupId}`);
    return done(publish ? "Service published." : "Service unpublished.");
  } catch (error) {
    log.error("publish service failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong.");
  }
}

// ─── Skill groups ──────────────────────────────────────────────────────────

const skillGroupSchema = z.object({
  key: z.string().min(1, "Key is required").max(KEY),
  label: z.string().min(1, "Label is required").max(SHORT),
});

// The unique key stays fixed once created — it is this group's stable identifier, unlike the service group (which has no key, just a name).
const updateSkillGroupSchema = skillGroupSchema.omit({ key: true });

export async function createSkillGroupAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const parsed = skillGroupSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));

  try {
    const created = await withTx(async (tx) => {
      const nextSort = await tx.skillGroups.nextSortOrder();

      const group = await tx.skillGroups.create({ key: parsed.data.key, label: parsed.data.label, sortOrder: nextSort });

      await audit({
        action: "collection.skills.group.created",
        actor: auth.user,
        entityType: "SkillGroup",
        entityId: group.id,
        before: null,
        after: group,
        ip: null,
        userAgent: null,
      }, tx);

      return group;
    });

    await invalidate(forCollection("skills"));
    revalidatePath("/admin/works/skills");
    return done("Skill group created. Add skills to it below.");
  } catch (error) {
    log.error("create skill group failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function updateSkillGroupAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Skill group ID is required.");

  const parsed = updateSkillGroupSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));

  try {
    const before = await repos.skillGroups.find(id);
    if (!before) return fail("Skill group not found.");

    const expected = parseSubmittedUpdatedAt(formData.get("updatedAt"));
    if (!expected) return fail(STALE_FORM_MESSAGE);
    await withTx(async (tx) => {
      const updated = await tx.skillGroups.updateIfUnchanged(id, expected, { label: parsed.data.label });
      if (!updated) throw new CollectionConflictError();
      await audit({
        action: "collection.skills.group.updated",
        actor: auth.user,
        entityType: "SkillGroup",
        entityId: id,
        before,
        after: updated,
        ip: null,
        userAgent: null,
      }, tx);
    });

    await invalidate(forCollection("skills"));
    revalidatePath("/admin/works/skills");
    revalidatePath(`/admin/works/skills/${id}`);
    return done("Skill group updated.");
  } catch (error) {
    if (error instanceof CollectionConflictError) return fail(COLLECTION_CONFLICT_MESSAGE);
    log.error("update skill group failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function deleteSkillGroupAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Skill group ID is required.");

  try {
    const before = await repos.skillGroups.findWithSkills(id);
    if (!before) return fail("Skill group not found.");

    await withTx(async (tx) => {
      // Deleting a group also removes every skill in it.
      await tx.skillGroups.delete(id);
      await audit({
        action: "collection.skills.group.deleted",
        actor: auth.user,
        entityType: "SkillGroup",
        entityId: id,
        before,
        after: null,
        ip: null,
        userAgent: null,
      }, tx);
    });

    await invalidate(forCollection("skills"));
    revalidatePath("/admin/works/skills");
    return done("Skill group deleted.");
  } catch (error) {
    log.error("delete skill group failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

// ─── Skills ──────────────────────────────────────────────────────────────────

const createSkillSchema = z.object({
  groupId: z.string().min(1).max(KEY),
  name: z.string().min(1).max(SHORT),
  abbr: z.string().min(1).max(32),
  type: z.string().min(1).max(KEY),
  iconKey: z.string().min(1).max(KEY),
  variant: z.enum(["fill", "stroke"]).default("fill"),
  colorLight: z.string().max(KEY),
  colorDark: z.string().max(KEY),
});

// The group stays fixed once created — the same immutability as the project slug.
const updateSkillSchema = createSkillSchema.omit({ groupId: true });

export async function createSkillAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const parsed = createSkillSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fail("Invalid fields.", fieldErrorsFrom(parsed.error.issues));

  try {
    await withTx(async (tx) => {
      const nextSort = await tx.skills.nextSortOrder(parsed.data.groupId);

      const created = await tx.skills.create({
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
      });

      await audit({
        action: "collection.skills.created",
        actor: auth.user,
        entityType: "Skill",
        entityId: created.id,
        before: null,
        after: created,
        ip: null,
        userAgent: null,
      }, tx);
    });

    await invalidate(forCollection("skills"));
    revalidatePath("/admin/works/skills");
    revalidatePath(`/admin/works/skills/${parsed.data.groupId}`);
    return done("Skill created.");
  } catch (error) {
    log.error("create skill failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong.");
  }
}

export async function updateSkillAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("editCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Skill ID is required.");

  const parsed = updateSkillSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));

  try {
    const before = await repos.skills.find(id);
    if (!before) return fail("Skill not found.");

    const expected = parseSubmittedUpdatedAt(formData.get("updatedAt"));
    if (!expected) return fail(STALE_FORM_MESSAGE);
    await withTx(async (tx) => {
      const updated = await tx.skills.updateIfUnchanged(id, expected, {
        name: parsed.data.name,
        abbr: parsed.data.abbr,
        type: parsed.data.type,
        iconKey: parsed.data.iconKey,
        variant: parsed.data.variant,
        colorLight: parsed.data.colorLight,
        colorDark: parsed.data.colorDark,
      });
      if (!updated) throw new CollectionConflictError();

      await audit({
        action: "collection.skills.updated",
        actor: auth.user,
        entityType: "Skill",
        entityId: id,
        before,
        after: updated,
        ip: null,
        userAgent: null,
      }, tx);
    });

    await invalidate(forCollection("skills"));
    revalidatePath("/admin/works/skills");
    revalidatePath(`/admin/works/skills/${before.groupId}`);
    return done("Skill updated.");
  } catch (error) {
    if (error instanceof CollectionConflictError) return fail(COLLECTION_CONFLICT_MESSAGE);
    log.error("update skill failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function deleteSkillAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Skill ID is required.");

  try {
    const before = await repos.skills.find(id);
    if (!before) return fail("Skill not found.");

    await withTx(async (tx) => {
      await tx.trash.put([{ entityType: "Skill", entityId: id, label: before.name, data: { row: before }, deletedById: auth.user.id }]);
      await tx.skills.delete(id);
      await audit({
        action: "collection.skills.deleted",
        actor: auth.user,
        entityType: "Skill",
        entityId: id,
        before,
        after: null,
        ip: null,
        userAgent: null,
      }, tx);
    });

    await invalidate(forCollection("skills"));
    revalidatePath("/admin/works/skills");
    revalidatePath(`/admin/works/skills/${before.groupId}`);
    return done("Skill moved to the trash.");
  } catch (error) {
    log.error("delete skill failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function reorderSkillAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || !["up", "down"].includes(direction)) return fail("Invalid reorder request.");

  try {
    const current = await repos.skills.find(id);
    if (!current) return fail("Skill not found.");

    await withTx(async (tx) => {
      await tx.skills.move(current, direction === "up" ? "up" : "down");

      await audit({
        action: "collection.skills.reordered",
        actor: auth.user,
        entityType: "Skill",
        entityId: id,
        before: current,
        after: current,
        meta: { direction },
        ip: null,
        userAgent: null,
      }, tx);
    });

    await invalidate(forCollection("skills"));
    revalidatePath(`/admin/works/skills/${current.groupId}`);
    return done("Skill order updated.");
  } catch (error) {
    log.error("reorder skill failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function publishSkillAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("publishCollections");
  if (!auth.ok) return fail(auth.error);

  const id = formData.get("id") as string;
  const publish = formData.get("publish") === "true";
  if (!id) return fail("Skill ID required.");

  try {
    const before = await repos.skills.find(id);
    if (!before) return fail("Skill not found.");

    await withTx(async (tx) => {
      await tx.skills.update(id, { published: publish });
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

    await invalidate(forCollection("skills"));
    revalidatePath("/admin/works/skills");
    revalidatePath(`/admin/works/skills/${before.groupId}`);
    return done(publish ? "Skill published." : "Skill unpublished.");
  } catch (error) {
    log.error("publish skill failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong.");
  }
}
