"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import ActionForm, { ConfirmSubmitButton, SubmitButton } from "@/components/admin/ui/ActionForm";
import { badgeClass, buttonVariants, fieldClass, tableClass, tdClass, thClass } from "@/components/admin/ui/styles";
import type { ActionState } from "@/lib/actions/state";
import { bulkDeletePostsAction, bulkPostStatusAction } from "@/lib/actions/blog";
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

export default function BlogListClient({
  posts,
  canPublish,
  canDelete,
  q,
  page,
  totalPages,
  total,
}: {
  /** One page (up to 20 rows) from the server, already title-filtered by `q`. */
  posts: BlogListRow[];
  canPublish: boolean;
  canDelete: boolean;
  q: string;
  page: number;
  totalPages: number;
  total: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(q);
  const [status, setStatus] = useState<"all" | BlogListRow["status"]>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Debounced (~400ms) push of `q` into the URL, so the server re-runs the
  // title search without a full-page reload on every keystroke.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (searchInput === q) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (searchInput) params.set("q", searchInput);
      else params.delete("q");
      params.set("page", "1");
      router.push(`/admin/blog?${params.toString()}`);
    }, 400);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed value should re-arm the debounce
  }, [searchInput]);

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    router.push(`/admin/blog?${params.toString()}`);
  };

  // Status stays a client-side refinement over the current page of results
  // (server-side pagination/search covers `page` and `q` only).
  const visible = useMemo(() => posts.filter((post) => status === "all" || post.status === status), [posts, status]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((current) => (current.size === visible.length ? new Set() : new Set(visible.map((post) => post.id))));

  const idsJson = JSON.stringify([...selected]);
  const clearSelection = (state: ActionState) => {
    if (state.ok) setSelected(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search title"
          aria-label="Search posts by title"
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

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-3">
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          {canPublish ? (
            <ActionForm action={bulkPostStatusAction} onResult={clearSelection} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="ids" value={idsJson} />
              <SubmitButton name="action" value="publish" variant="small" pendingLabel="Working…">
                Publish
              </SubmitButton>
              <SubmitButton name="action" value="unpublish" variant="small" pendingLabel="Working…">
                Unpublish
              </SubmitButton>
              <SubmitButton name="action" value="archive" variant="smallDanger" pendingLabel="Working…">
                Archive
              </SubmitButton>
            </ActionForm>
          ) : null}
          {canDelete ? (
            <ActionForm action={bulkDeletePostsAction} onResult={clearSelection} className="flex items-center gap-2">
              <input type="hidden" name="ids" value={idsJson} />
              <ConfirmSubmitButton
                variant="smallDanger"
                pendingLabel="Deleting…"
                confirmMessage={`Delete ${selected.size} post${selected.size === 1 ? "" : "s"}? This cannot be undone.`}
              >
                Delete
              </ConfirmSubmitButton>
            </ActionForm>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr className="border-b border-border">
              {canPublish || canDelete ? (
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
                {canPublish || canDelete ? (
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

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Showing {posts.length === 0 ? 0 : (page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => goToPage(Math.max(1, page - 1))} disabled={page <= 1} className={buttonVariants.small}>
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className={buttonVariants.small}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
