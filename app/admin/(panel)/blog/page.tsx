import Link from "next/link";

import { hasPermission, requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import { buttonVariants } from "@/components/admin/ui/styles";

import BlogListClient, { type BlogListRow } from "@/components/admin/blog/BlogListClient";

export const metadata = { title: "Blog" };

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function BlogListPage({ searchParams }: PageProps) {
  const user = await requirePermission("viewBlog");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);

  // Title search only (case-insensitive contains); the list never selects
  // contentHtml/content/contentText, so a page of rows stays small regardless
  // of how large individual post bodies are.
  const where = q ? { title: { contains: q, mode: "insensitive" as const } } : {};

  const [rows, total] = await Promise.all([
    db.post.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: { id: true, slug: true, title: true, topic: true, status: true, publishAt: true, publishedAt: true, updatedAt: true },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.post.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

      <BlogListClient
        posts={posts}
        canPublish={hasPermission(user, "publishBlog")}
        canDelete={hasPermission(user, "deleteBlog")}
        q={q}
        page={page}
        totalPages={totalPages}
        total={total}
      />
    </div>
  );
}
