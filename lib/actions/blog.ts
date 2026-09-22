"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorizeAction } from "@/lib/actions/guard";
import type { ActionState } from "@/lib/actions/state";
import { done, fail, fieldErrorsFrom } from "@/lib/actions/state";
import { audit } from "@/lib/admin/audit";
import { invalidate } from "@/lib/cache/invalidate";
import { forPost, forPostList } from "@/lib/cache/plan";
import { db } from "@/lib/db/prisma";
import { extractText, sanitizeRich } from "@/lib/cms/rich-text";
import { postInputSchema, publishActionSchema } from "@/lib/blog/schema";
import { computeReadMinutes } from "@/lib/blog/readtime";
import { log } from "@/lib/log";

// Blog CRUD and status actions (docs/plan/admin-cms-adr.md, Step 12). Draft
// create/update/read use editBlog; every status change (publish, schedule,
// unpublish, archive) and delete use publishBlog / deleteBlog. `content`
// (raw editor HTML) is re-sanitized on every save into `contentHtml` and
// `contentText` — the client-sent copies of those two fields are never
// trusted, even if the RichEditor already sanitized on its side. A status
// change that touches PUBLISHED invalidates the public cache in the same
// call that commits the change.

const ADMIN_LIST_PATH = "/admin/blog";

function computed(content: string) {
  const contentHtml = sanitizeRich(content);
  const contentText = extractText(contentHtml);
  return { contentHtml, contentText, readMinutes: computeReadMinutes(contentText) };
}

async function slugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const existing = await db.post.findUnique({ where: { slug }, select: { id: true } });
  return Boolean(existing && existing.id !== excludeId);
}

function payloadFrom(formData: FormData): Record<string, unknown> {
  const raw = Object.fromEntries(formData.entries());
  const tags = raw.tags;
  return {
    ...raw,
    tags: typeof tags === "string" && tags.length > 0 ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
  };
}

export async function createPostAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("editBlog");
  if (!auth.ok) return fail(auth.error);

  const parsed = postInputSchema.safeParse(payloadFrom(formData));
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));

  if (await slugTaken(parsed.data.slug)) {
    return fail("Some fields need attention.", { slug: "This slug is already in use." });
  }

  let createdId: string;
  try {
    const extra = computed(parsed.data.content);
    const created = await db.$transaction(async (tx) => {
      const row = await tx.post.create({
        data: {
          slug: parsed.data.slug,
          title: parsed.data.title,
          excerpt: parsed.data.excerpt || null,
          content: parsed.data.content,
          contentHtml: extra.contentHtml,
          contentText: extra.contentText,
          readMinutes: extra.readMinutes,
          topic: parsed.data.topic,
          tags: parsed.data.tags,
          coverMediaId: parsed.data.coverMediaId || null,
          coverAlt: parsed.data.coverAlt || null,
          seoTitle: parsed.data.seoTitle || null,
          seoDescription: parsed.data.seoDescription || null,
          canonicalUrl: parsed.data.canonicalUrl || null,
          status: "DRAFT",
          authorId: auth.user.id,
        },
      });
      await audit(
        { action: "post.created", actor: auth.user, entityType: "Post", entityId: row.id, before: null, after: row },
        tx
      );
      return row;
    });
    revalidatePath(ADMIN_LIST_PATH);
    createdId = created.id;
  } catch (error) {
    log.error("create post failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
  // redirect() throws internally; it must not be inside the try/catch above.
  redirect(`/admin/blog/${createdId}`);
}

export async function updatePostAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("editBlog");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Post ID is required.");

  const parsed = postInputSchema.safeParse(payloadFrom(formData));
  if (!parsed.success) return fail("Some fields need attention.", fieldErrorsFrom(parsed.error.issues));

  try {
    const before = await db.post.findUnique({ where: { id } });
    if (!before) return fail("Post not found.");

    if (parsed.data.slug !== before.slug && (await slugTaken(parsed.data.slug, id))) {
      return fail("Some fields need attention.", { slug: "This slug is already in use." });
    }

    const extra = computed(parsed.data.content);
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.post.update({
        where: { id },
        data: {
          slug: parsed.data.slug,
          title: parsed.data.title,
          excerpt: parsed.data.excerpt || null,
          content: parsed.data.content,
          contentHtml: extra.contentHtml,
          contentText: extra.contentText,
          readMinutes: extra.readMinutes,
          topic: parsed.data.topic,
          tags: parsed.data.tags,
          coverMediaId: parsed.data.coverMediaId || null,
          coverAlt: parsed.data.coverAlt || null,
          seoTitle: parsed.data.seoTitle || null,
          seoDescription: parsed.data.seoDescription || null,
          canonicalUrl: parsed.data.canonicalUrl || null,
        },
      });
      await audit(
        { action: "post.updated", actor: auth.user, entityType: "Post", entityId: id, before, after: row },
        tx
      );
      return row;
    });

    // Editing the text of a post that is already public must refresh what
    // visitors see; a draft edit has nothing public to invalidate.
    if (before.status === "PUBLISHED" || updated.slug !== before.slug) {
      invalidate(forPost(before.slug));
      if (updated.slug !== before.slug) invalidate(forPost(updated.slug));
    }
    revalidatePath(ADMIN_LIST_PATH);
    return done("Post updated.");
  } catch (error) {
    log.error("update post failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

export async function deletePostAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("deleteBlog");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Post ID is required.");

  try {
    const before = await db.post.findUnique({ where: { id } });
    if (!before) return fail("Post not found.");

    await db.$transaction(async (tx) => {
      await tx.post.delete({ where: { id } });
      await audit(
        { action: "post.deleted", actor: auth.user, entityType: "Post", entityId: id, before, after: null },
        tx
      );
    });

    if (before.status === "PUBLISHED" || before.status === "SCHEDULED") invalidate(forPost(before.slug));
    revalidatePath(ADMIN_LIST_PATH);
    return done("Post deleted.");
  } catch (error) {
    log.error("delete post failed", { error: error instanceof Error ? error.message : String(error) });
    return fail("Something went wrong. Please try again.");
  }
}

async function applyStatus(
  id: string,
  action: "publish" | "schedule" | "unpublish" | "archive",
  publishAt: Date | null,
  actor: { id: string; email: string }
): Promise<ActionState> {
  try {
    const before = await db.post.findUnique({ where: { id } });
    if (!before) return fail("Post not found.");

    const data =
      action === "publish"
        ? { status: "PUBLISHED" as const, publishAt: null, publishedAt: new Date() }
        : action === "schedule"
          ? { status: "SCHEDULED" as const, publishAt, publishedAt: null }
          : action === "unpublish"
            ? { status: "DRAFT" as const, publishAt: null, publishedAt: null }
            : { status: "ARCHIVED" as const, publishAt: null };

    const updated = await db.$transaction(async (tx) => {
      const row = await tx.post.update({ where: { id }, data });
      await audit(
        {
          action:
            action === "publish"
              ? "post.published"
              : action === "schedule"
                ? "post.scheduled"
                : action === "unpublish"
                  ? "post.unpublished"
                  : "post.archived",
          actor,
          entityType: "Post",
          entityId: id,
          before,
          after: row,
        },
        tx
      );
      return row;
    });

    // Any status change touching PUBLISHED (becoming it, or leaving it) must
    // refresh the public cache; a draft <-> scheduled transition has nothing
    // public to invalidate yet.
    if (before.status === "PUBLISHED" || updated.status === "PUBLISHED") {
      invalidate(forPost(before.slug));
    }
    revalidatePath(ADMIN_LIST_PATH);

    const messages = {
      publish: "Post published.",
      schedule: "Post scheduled.",
      unpublish: "Post moved back to draft.",
      archive: "Post archived.",
    };
    return done(messages[action]);
  } catch (error) {
    log.error("post status change failed", { error: error instanceof Error ? error.message : String(error), action });
    return fail("Something went wrong. Please try again.");
  }
}

export async function setPostStatusAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("publishBlog");
  if (!auth.ok) return fail(auth.error);

  const id = String(formData.get("id") ?? "");
  const actionParsed = publishActionSchema.safeParse(formData.get("action"));
  if (!id || !actionParsed.success) return fail("Invalid request.");

  let publishAt: Date | null = null;
  if (actionParsed.data === "schedule") {
    const raw = String(formData.get("publishAt") ?? "");
    const parsedDate = new Date(raw);
    if (!raw || Number.isNaN(parsedDate.getTime())) {
      return fail("Some fields need attention.", { publishAt: "A valid publish date and time is required." });
    }
    publishAt = parsedDate;
  }

  return applyStatus(id, actionParsed.data, publishAt, auth.user);
}

const MAX_BULK = 100;

export async function bulkPostStatusAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction("publishBlog");
  if (!auth.ok) return fail(auth.error);

  const actionParsed = publishActionSchema.safeParse(formData.get("action"));
  const idsRaw = String(formData.get("ids") ?? "");
  if (!actionParsed.success || actionParsed.data === "schedule") {
    return fail("Bulk schedule is not supported; open each post to schedule it.");
  }

  let ids: string[];
  try {
    ids = JSON.parse(idsRaw);
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) throw new Error("bad shape");
  } catch {
    return fail("Invalid selection.");
  }
  if (ids.length === 0) return fail("Select at least one post.");
  if (ids.length > MAX_BULK) return fail(`Select ${MAX_BULK} posts or fewer at a time.`);

  let changed = 0;
  for (const id of ids) {
    const result = await applyStatus(id, actionParsed.data, null, auth.user);
    if (result.ok) changed += 1;
  }

  revalidatePath(ADMIN_LIST_PATH);
  return done(`Updated ${changed} of ${ids.length} posts.`);
}
