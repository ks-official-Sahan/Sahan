import Link from "next/link";

import { hasPermission, requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import { buttonVariants } from "@/components/admin/ui/styles";

import BlogListClient, { type BlogListRow } from "@/components/admin/blog/BlogListClient";

export const metadata = { title: "Blog" };

export default async function BlogListPage() {
  const user = await requirePermission("viewBlog");

  const rows = await db.post.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, slug: true, title: true, topic: true, status: true, publishAt: true, publishedAt: true, updatedAt: true },
  });

  const posts: BlogListRow[] = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    topic: row.topic,
    status: row.status,
    publishAt: row.publishAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Blog</h1>
          <p className="text-sm text-muted-foreground">Updates shown on the public /updates page.</p>
        </div>
        {hasPermission(user, "editBlog") ? (
          <Link href="/admin/blog/new" className={buttonVariants.primary}>
            New post
          </Link>
        ) : null}
      </div>

      <BlogListClient posts={posts} canPublish={hasPermission(user, "publishBlog")} />
    </div>
  );
}
