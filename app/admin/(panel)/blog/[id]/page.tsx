import { notFound } from "next/navigation";

import { hasPermission, requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import ActionForm, { SubmitButton } from "@/components/admin/ui/ActionForm";
import { badgeClass, buttonVariants, fieldClass } from "@/components/admin/ui/styles";
import { deletePostAction, setPostStatusAction, updatePostAction } from "@/lib/actions/blog";

import BlogEditorForm from "@/components/admin/blog/BlogEditorForm";

export const metadata = { title: "Edit post" };

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("editBlog");

  const post = await db.post.findUnique({ where: { id } });
  if (!post) notFound();

  const canPublish = hasPermission(user, "publishBlog");
  const canDelete = hasPermission(user, "deleteBlog");

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{post.title}</h1>
          <p className="text-sm text-muted-foreground">
            <span className={badgeClass}>{post.status}</span> · /updates/{post.slug}
          </p>
        </div>
      </div>

      {canPublish ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
          <span className="text-sm font-medium">Status</span>
          <ActionForm action={setPostStatusAction} className="contents">
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

          <details className="w-full">
            <summary className="cursor-pointer text-sm text-muted-foreground">Schedule for later</summary>
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
      ) : null}

      <BlogEditorForm
        action={updatePostAction}
        canUseAi={hasPermission(user, "generateAI")}
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
          seoTitle: post.seoTitle ?? "",
          seoDescription: post.seoDescription ?? "",
          canonicalUrl: post.canonicalUrl ?? "",
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
