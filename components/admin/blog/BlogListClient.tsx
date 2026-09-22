"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import ActionForm, { SubmitButton } from "@/components/admin/ui/ActionForm";
import { badgeClass, buttonVariants, fieldClass, tableClass, tdClass, thClass } from "@/components/admin/ui/styles";
import { bulkPostStatusAction } from "@/lib/actions/blog";
import { cn } from "@/lib/utils";

export interface BlogListRow {
  id: string;
  slug: string;
  title: string;
  topic: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
  publishAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

const STATUS_LABEL: Record<BlogListRow["status"], string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export default function BlogListClient({ posts, canPublish }: { posts: BlogListRow[]; canPublish: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | BlogListRow["status"]>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return posts.filter(
      (post) =>
        (status === "all" || post.status === status) &&
        (!needle || post.title.toLowerCase().includes(needle) || post.slug.toLowerCase().includes(needle))
    );
  }, [posts, search, status]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((current) => (current.size === visible.length ? new Set() : new Set(visible.map((post) => post.id))));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title or slug"
          aria-label="Search posts"
          className={cn(fieldClass, "max-w-xs")}
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          aria-label="Filter by status"
          className={fieldClass}
        >
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABEL) as Array<BlogListRow["status"]>).map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </select>
      </div>

      {canPublish && selected.size > 0 ? (
        <ActionForm action={bulkPostStatusAction} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-3">
          <input type="hidden" name="ids" value={JSON.stringify([...selected])} />
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          <button type="submit" name="action" value="publish" className={buttonVariants.small}>
            Publish
          </button>
          <button type="submit" name="action" value="unpublish" className={buttonVariants.small}>
            Unpublish
          </button>
          <button type="submit" name="action" value="archive" className={buttonVariants.smallDanger}>
            Archive
          </button>
        </ActionForm>
      ) : null}

      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className="border-b border-border">
              {canPublish ? (
                <th className={thClass}>
                  <input
                    type="checkbox"
                    aria-label="Select all visible posts"
                    checked={visible.length > 0 && selected.size === visible.length}
                    onChange={toggleAll}
                  />
                </th>
              ) : null}
              <th className={thClass}>Title</th>
              <th className={thClass}>Topic</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Updated</th>
              <th className={thClass}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((post) => (
              <tr key={post.id} className="border-b border-border/60">
                {canPublish ? (
                  <td className={tdClass}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${post.title}`}
                      checked={selected.has(post.id)}
                      onChange={() => toggle(post.id)}
                    />
                  </td>
                ) : null}
                <td className={tdClass}>
                  <Link href={`/admin/blog/${post.id}`} className="font-medium hover:underline">
                    {post.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">/updates/{post.slug}</div>
                </td>
                <td className={tdClass}>{post.topic}</td>
                <td className={tdClass}>
                  <span className={badgeClass}>{STATUS_LABEL[post.status]}</span>
                </td>
                <td className={cn(tdClass, "text-sm text-muted-foreground")}>{new Date(post.updatedAt).toLocaleDateString()}</td>
                <td className={tdClass}>
                  <Link href={`/admin/blog/${post.id}`} className="text-sm text-primary hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No posts match.</p> : null}
      </div>
    </div>
  );
}
