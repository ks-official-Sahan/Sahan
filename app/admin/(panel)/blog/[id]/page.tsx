import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { hasPermission, requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import { SiteMetadata } from "@/config/site";
import ActionForm, { SubmitButton } from "@/components/admin/ui/ActionForm";
import { badgeClass, buttonVariants, fieldClass } from "@/components/admin/ui/styles";
import { deletePostAction, setPostStatusAction, updatePostAction } from "@/lib/actions/blog";

import BlogEditorForm from "@/components/admin/blog/BlogEditorForm";

export const metadata = { title: "Edit post" };

async function loadTaxonomy(excludeId: string) {
  const [topicRows, tagRows] = await Promise.all([
    db.post.findMany({ distinct: ["topic"], select: { topic: true }, orderBy: { topic: "asc" } }),
    db.post.findMany({ where: { id: { not: excludeId } }, select: { tags: true }, take: 200 }),
  ]);
  return {
    topics: topicRows.map((row) => row.topic).filter(Boolean),
    tags: [...new Set(tagRows.flatMap((row) => row.tags))].sort(),
  };
}

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("editBlog");

  const post = await db.post.findUnique({ where: { id }, include: { coverMedia: { select: { url: true } } } });
  if (!post) notFound();

  const canPublish = hasPermission(user, "publishBlog");
  const canDelete = hasPermission(user, "deleteBlog");
  const { topics, tags } = await loadTaxonomy(id);
  const siteUrl = new URL(SiteMetadata.siteUrl).host;

  const statusPanel = canPublish ? (
    <div className="space-y-3">
      <ActionForm action={setPostStatusAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={post.id} />
        {post.status !== "PUBLISHED" ? (
          <button type="submit" name="action" value="publish" className={buttonVariants.small}>
            Publish now
          </button>
        ) : null}
        {post.status !== "ARCHIVED" ? (
          <button type="submit" name="action" value="unpublish" className={buttonVariants.small}>
            Move to draft
          </button>
        ) : null}
        {post.status !== "ARCHIVED" ? (
          <button type="submit" name="action" value="archive" className={buttonVariants.smallDanger}>
            Archive
          </button>
        ) : null}
      </ActionForm>

      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">Schedule for later</summary>
        <ActionForm action={setPostStatusAction} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={post.id} />
          <input type="hidden" name="action" value="schedule" />
          <input
            type="datetime-local"
            name="publishAt"
            required
            className={fieldClass}
            defaultValue={post.publishAt ? post.publishAt.toISOString().slice(0, 16) : undefined}
          />
          <SubmitButton variant="secondary" pendingLabel="Scheduling…">
            Schedule
          </SubmitButton>
        </ActionForm>
      </details>
    </div>
  ) : (
    <span className={badgeClass}>{post.status}</span>
  );

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/blog"
          aria-label="Back to posts"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{post.title}</h1>
          <p className="text-sm text-muted-foreground">
            <span className={badgeClass}>{post.status}</span> · /updates/{post.slug}
          </p>
        </div>
      </div>

      <BlogEditorForm
        action={updatePostAction}
        canUseAi={hasPermission(user, "generateAI")}
        canPublish={canPublish}
        existingTopics={topics}
        existingTags={tags}
        siteUrl={siteUrl}
        statusPanel={statusPanel}
        post={{
          id: post.id,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt ?? "",
          content: post.content,
          topic: post.topic,
          tags: post.tags,
          coverMediaId: post.coverMediaId ?? "",
          coverAlt: post.coverAlt ?? "",
          coverSrc: post.coverMedia?.url,
          seoTitle: post.seoTitle ?? "",
          seoDescription: post.seoDescription ?? "",
          canonicalUrl: post.canonicalUrl ?? "",
          status: post.status,
        }}
      />

      {canDelete ? (
        <ActionForm action={deletePostAction} className="border-t border-border pt-6">
          <input type="hidden" name="id" value={post.id} />
          <SubmitButton variant="danger" pendingLabel="Deleting…">
            Delete post
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
}
