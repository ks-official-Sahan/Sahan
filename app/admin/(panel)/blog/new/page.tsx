import { hasPermission, requirePermission } from "@/lib/auth/dal";
import { createPostAction } from "@/lib/actions/blog";

import BlogEditorForm from "@/components/admin/blog/BlogEditorForm";

export const metadata = { title: "New post" };

export default async function NewBlogPostPage() {
  const user = await requirePermission("editBlog");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New post</h1>
        <p className="text-sm text-muted-foreground">Saved as a draft. Publishing is a separate step.</p>
      </div>
      <BlogEditorForm action={createPostAction} canUseAi={hasPermission(user, "generateAI")} />
    </div>
  );
}
