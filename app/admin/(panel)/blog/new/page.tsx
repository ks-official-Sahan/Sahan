import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { hasPermission, requirePermission } from "@/lib/auth/dal";
import { createPostAction } from "@/lib/actions/blog";
import { db } from "@/lib/db/prisma";
import { SiteMetadata } from "@/config/site";

import BlogEditorForm from "@/components/admin/blog/BlogEditorForm";

export const metadata = { title: "New post" };

async function loadTaxonomy() {
  const [topicRows, tagRows] = await Promise.all([
    db.post.findMany({ distinct: ["topic"], select: { topic: true }, orderBy: { topic: "asc" } }),
    db.post.findMany({ select: { tags: true }, take: 200 }),
  ]);
  return {
    topics: topicRows.map((row) => row.topic).filter(Boolean),
    tags: [...new Set(tagRows.flatMap((row) => row.tags))].sort(),
  };
}

export default async function NewBlogPostPage() {
  const user = await requirePermission("editBlog");
  const { topics, tags } = await loadTaxonomy();
  const siteUrl = new URL(SiteMetadata.siteUrl).host;

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
          <h1 className="text-2xl font-semibold">Create New Post</h1>
          <p className="text-sm text-muted-foreground">Write content using TipTap and AI generation.</p>
        </div>
      </div>
      <BlogEditorForm
        action={createPostAction}
        canUseAi={hasPermission(user, "generateAI")}
        canPublish={hasPermission(user, "publishBlog")}
        existingTopics={topics}
        existingTags={tags}
        siteUrl={siteUrl}
      />
    </div>
  );
}
