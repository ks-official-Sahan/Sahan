"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import ActionForm, { Field, SubmitButton } from "@/components/admin/ui/ActionForm";
import type { ActionState } from "@/lib/actions/state";
import { buttonVariants, cardClass, fieldClass } from "@/components/admin/ui/styles";
import { draftStorageKey, isDraftNewer } from "@/lib/blog/draft";
import { slugify } from "@/lib/blog/slug";
import { cn } from "@/lib/utils";

import AiAssistantCard, { type AiPatch } from "./AiAssistantCard";
import BodyEditorCard, { type BodyMode } from "./BodyEditorCard";
import FeaturedImageCard from "./FeaturedImageCard";
import PublishingCard from "./PublishingCard";

// The blog post editor: create and update share this component (per the
// task, "new and edit should share the same editor component"). Field
// changes (title, slug, body, cover, SEO, topic/tags) go through
// createPostAction/updatePostAction as before; the AI Assistant card only
// ever writes into this component's own state via onPatch — it never talks
// to the database directly.

export interface EditablePost {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  topic: string;
  tags: string[];
  coverMediaId: string;
  coverAlt: string;
  /** Existing cover image URL, so the edit page's Featured image card shows what is already set. */
  coverSrc?: string;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  status?: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
  /** ISO `updatedAt`, carried in a hidden field for updatePostAction's optimistic-concurrency check. Absent for a new, unsaved post. */
  updatedAt?: string;
}

const EMPTY_POST: EditablePost = {
  slug: "",
  title: "",
  excerpt: "",
  content: "",
  topic: "",
  tags: [],
  coverMediaId: "",
  coverAlt: "",
  seoTitle: "",
  seoDescription: "",
  canonicalUrl: "",
  status: "DRAFT",
};

// ─── Local autosave (browser-only; never sent to the server) ───────────────
// Keyed per post id ("new" for the create form) via lib/blog/draft.ts's
// draftStorageKey. Every access is wrapped in try/catch: private browsing,
// disabled storage, or a full quota must never break the editor.

interface StoredDraft {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  topic: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  coverMediaId: string;
  coverAlt: string;
  coverSrc: string | null;
  savedAt: string;
}

function readDraft(key: string): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft> | null;
    if (!parsed || typeof parsed.savedAt !== "string" || typeof parsed.title !== "string") return null;
    return parsed as StoredDraft;
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: StoredDraft): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Private mode, disabled storage, or over quota — autosave is a nicety, not a requirement.
  }
}

function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Same as above: never let a storage failure surface as an editor error.
  }
}

// ─── SEO field counters ─────────────────────────────────────────────────────

/** Live character counter with a soft warning colour outside the aim range. Never blocks input — the field's own `maxLength` is the hard cap. */
function FieldCounter({ id, value, max, aim }: { id: string; value: string; max: number; aim?: { min?: number; max: number } }) {
  const length = value.length;
  const warn = aim ? length > aim.max || (aim.min !== undefined && length > 0 && length < aim.min) : false;
  return (
    <p id={id} className={cn("mt-1 text-right text-xs tabular-nums", warn ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
      {length}/{max}
    </p>
  );
}

export default function BlogEditorForm({
  action,
  post,
  canUseAi,
  canPublish = false,
  existingTopics = [],
  existingTags = [],
  siteUrl,
  statusPanel,
}: {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  post?: EditablePost;
  canUseAi: boolean;
  /** Whether this actor can publish/schedule (hasPermission(user, "publishBlog")). */
  canPublish?: boolean;
  /** Distinct topics already in use, offered as chips. */
  existingTopics?: string[];
  /** Recently used tags, offered as suggestions. */
  existingTags?: string[];
  /** This site's own origin, e.g. "sahansachintha.com" — for the "<site>/updates/<slug>" line. */
  siteUrl: string;
  /** Edit page only: its existing publish/schedule/archive form, rendered inside the Publishing card. */
  statusPanel?: ReactNode;
}) {
  const initial = post ?? EMPTY_POST;
  const storageKey = draftStorageKey(post?.id);

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [content, setContent] = useState(initial.content);
  const [bodyMode, setBodyMode] = useState<BodyMode>("visual");
  const [topic, setTopic] = useState(initial.topic);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription);
  const [coverMediaId, setCoverMediaId] = useState(initial.coverMediaId);
  const [coverSrc, setCoverSrc] = useState<string | null>(initial.coverSrc ?? null);
  const [coverAlt, setCoverAlt] = useState(initial.coverAlt);
  const [coverBusy, setCoverBusy] = useState(false);
  const [generatedByAI, setGeneratedByAI] = useState(false);
  const [seoBusy, setSeoBusy] = useState(false);
  const [seoError, setSeoError] = useState<string | null>(null);

  // Optimistic concurrency: re-armed with the fresh value updatePostAction
  // returns after each successful save, so a second save right after the
  // first is never falsely flagged as a conflict.
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt ?? "");

  // Unsaved-changes tracking: `dirty` gates both the beforeunload warning and
  // whether autosave bothers writing. It flips true the first time any
  // tracked field changes after mount (never on the initial render, which is
  // just the loaded — or restored — values settling in) and back to false
  // once a save succeeds.
  const mountedRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<StoredDraft | null>(null);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setDirty(true);
    const timer = setTimeout(() => {
      writeDraft(storageKey, {
        title,
        slug,
        excerpt,
        content,
        topic,
        tags,
        seoTitle,
        seoDescription,
        coverMediaId,
        coverAlt,
        coverSrc,
        savedAt: new Date().toISOString(),
      });
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storageKey only changes with the post, not worth re-running for
  }, [title, slug, excerpt, content, topic, tags, seoTitle, seoDescription, coverMediaId, coverAlt, coverSrc]);

  // Offer a locally saved draft once, on mount, if it postdates what the
  // server actually has (lib/blog/draft.ts's isDraftNewer).
  useEffect(() => {
    const stored = readDraft(storageKey);
    if (stored && isDraftNewer(stored.savedAt, initial.updatedAt ?? null)) {
      setPendingDraft(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once, for the post this editor opened with
  }, []);

  // Warn only while there is something unsaved to lose.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function handleResult(state: ActionState) {
    if (!state.ok) return;
    if (state.updatedAt) setUpdatedAt(state.updatedAt);
    clearDraft(storageKey);
    setDirty(false);
  }

  function applyDraft() {
    if (!pendingDraft) return;
    setTitle(pendingDraft.title);
    setSlug(pendingDraft.slug);
    setSlugTouched(true);
    setExcerpt(pendingDraft.excerpt);
    setContent(pendingDraft.content);
    setTopic(pendingDraft.topic);
    setTags(pendingDraft.tags);
    setSeoTitle(pendingDraft.seoTitle);
    setSeoDescription(pendingDraft.seoDescription);
    setCoverMediaId(pendingDraft.coverMediaId);
    setCoverAlt(pendingDraft.coverAlt);
    setCoverSrc(pendingDraft.coverSrc);
    setDirty(true);
    setPendingDraft(null);
  }

  function discardDraft() {
    clearDraft(storageKey);
    setPendingDraft(null);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function handleAiPatch(patch: AiPatch) {
    switch (patch.type) {
      case "start":
        setBodyMode("visual");
        setGeneratedByAI(true);
        break;
      case "meta":
        setTitle(patch.title);
        setSlug(patch.slug);
        setSlugTouched(true);
        setExcerpt(patch.excerpt);
        setSeoTitle(patch.seoTitle);
        setSeoDescription(patch.seoDescription);
        setTopic(patch.topic);
        setTags(patch.tags);
        break;
      case "body":
        setContent(patch.html);
        break;
      case "featuredAlt":
        setCoverAlt((current) => current || patch.alt);
        break;
      case "featuredImageBusy":
        setCoverBusy(patch.busy);
        break;
      case "featuredImage":
        setCoverMediaId(patch.mediaId);
        setCoverSrc(patch.url);
        setCoverAlt(patch.alt);
        break;
      case "error":
        break;
    }
  }

  async function suggestSeo() {
    setSeoBusy(true);
    setSeoError(null);
    try {
      const response = await fetch("/api/admin/ai/seo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, contentText: excerpt || content.replace(/<[^>]+>/g, " ").slice(0, 4000) }),
      });
      const data = (await response.json()) as { ok: boolean; seoTitle?: string; seoDescription?: string; excerpt?: string; error?: string };
      if (!data.ok || !data.seoTitle) {
        setSeoError(data.error || "Could not suggest SEO fields.");
        return;
      }
      setSeoTitle(data.seoTitle);
      setSeoDescription(data.seoDescription || "");
      if (!excerpt && data.excerpt) setExcerpt(data.excerpt);
    } catch {
      setSeoError("The AI assistant is unreachable right now.");
    } finally {
      setSeoBusy(false);
    }
  }

  return (
    <ActionForm action={action} onResult={handleResult} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {post?.id ? <input type="hidden" name="id" defaultValue={post.id} /> : null}
      {post?.id ? <input type="hidden" name="updatedAt" value={updatedAt} /> : null}
      <input type="hidden" name="content" value={content} />
      <input type="hidden" name="topic" value={topic} />
      <input type="hidden" name="tags" value={tags.join(",")} />
      <input type="hidden" name="coverMediaId" value={coverMediaId} />
      <input type="hidden" name="coverAlt" value={coverAlt} />
      <input type="hidden" name="generatedByAI" value={generatedByAI ? "1" : "0"} />

      {pendingDraft ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm lg:col-span-2">
          <span>
            You have unsaved changes from {new Date(pendingDraft.savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={applyDraft} className={buttonVariants.small}>
              Restore unsaved draft
            </button>
            <button type="button" onClick={discardDraft} className={buttonVariants.small}>
              Discard
            </button>
          </div>
        </div>
      ) : null}

      {/* Left column */}
      <div className="space-y-6">
        <div className={cardClass}>
          <label htmlFor="post-title" className="sr-only">
            Post title
          </label>
          <input
            id="post-title"
            name="title"
            value={title}
            onChange={(event) => handleTitleChange(event.target.value)}
            placeholder="Post Title…"
            required
            maxLength={200}
            className="w-full border-0 bg-transparent text-2xl font-semibold tracking-tight text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <span>{siteUrl}/updates/</span>
            <input
              name="slug"
              value={slug}
              onChange={(event) => {
                setSlug(slugify(event.target.value));
                setSlugTouched(true);
              }}
              required
              maxLength={96}
              aria-label="Slug"
              className="min-w-0 flex-1 border-0 bg-transparent font-mono text-sm text-primary focus-visible:outline-none"
            />
          </div>
        </div>

        <BodyEditorCard content={content} onChange={setContent} mode={bodyMode} onModeChange={setBodyMode} />

        {canUseAi ? <AiAssistantCard onPatch={handleAiPatch} /> : null}
      </div>

      {/* Right column */}
      <div className="space-y-6">
        <FeaturedImageCard
          src={coverSrc}
          alt={coverAlt}
          onAltChange={setCoverAlt}
          onSelect={(result) => {
            setCoverMediaId(result.mediaId);
            setCoverSrc(result.src);
            if (!coverAlt) setCoverAlt(result.alt);
          }}
          onClear={() => {
            setCoverMediaId("");
            setCoverSrc(null);
          }}
        />
        {coverBusy ? <p className="text-xs text-muted-foreground">Generating featured image…</p> : null}

        <PublishingCard
          status={initial.status ?? "DRAFT"}
          topic={topic}
          onTopicChange={setTopic}
          existingTopics={existingTopics}
          tags={tags}
          onTagsChange={setTags}
          existingTags={existingTags}
          statusPanel={statusPanel}
          canPublish={canPublish}
        />

        <div className={cardClass}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">SEO &amp; Metadata</h2>
            {canUseAi ? (
              <button
                type="button"
                onClick={suggestSeo}
                disabled={seoBusy || !title}
                className="rounded-md border border-input bg-background px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60"
              >
                {seoBusy ? "Suggesting…" : "✨ Suggest SEO"}
              </button>
            ) : null}
          </div>
          {seoError ? <p className="mb-2 text-xs text-destructive">{seoError}</p> : null}

          <label htmlFor="excerpt" className="text-sm font-medium">
            Excerpt (short summary)
          </label>
          <textarea
            id="excerpt"
            name="excerpt"
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            maxLength={500}
            aria-describedby="excerpt-counter"
            className={cn(fieldClass, "mt-1.5 min-h-20 py-2")}
          />
          <FieldCounter id="excerpt-counter" value={excerpt} max={500} />

          <label htmlFor="seoTitle" className="mt-3 block text-sm font-medium">
            SEO title
          </label>
          <input
            id="seoTitle"
            name="seoTitle"
            value={seoTitle}
            onChange={(event) => setSeoTitle(event.target.value)}
            maxLength={70}
            placeholder="Defaults to post title"
            aria-describedby="seoTitle-counter"
            className={cn(fieldClass, "mt-1.5")}
          />
          <FieldCounter id="seoTitle-counter" value={seoTitle} max={70} aim={{ max: 60 }} />

          <label htmlFor="seoDescription" className="mt-3 block text-sm font-medium">
            SEO description
          </label>
          <textarea
            id="seoDescription"
            name="seoDescription"
            value={seoDescription}
            onChange={(event) => setSeoDescription(event.target.value)}
            maxLength={200}
            aria-describedby="seoDescription-counter"
            className={cn(fieldClass, "mt-1.5 min-h-16 py-2")}
          />
          <FieldCounter id="seoDescription-counter" value={seoDescription} max={200} aim={{ min: 120, max: 160 }} />

          <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Search result preview</p>
            <p className="mt-1 truncate text-sm text-primary">{seoTitle || title || "Untitled post"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {siteUrl}/updates/{slug || "…"}
            </p>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{seoDescription || excerpt || "No description yet."}</p>
          </div>

          <Field label="Canonical URL" name="canonicalUrl" defaultValue={initial.canonicalUrl} hint="Only needed if this post was published elsewhere first." className="mt-3" />
        </div>

        {statusPanel ? (
          <div className={cardClass}>
            <SubmitButton pendingLabel="Saving…" className="w-full">
              Save changes
            </SubmitButton>
          </div>
        ) : null}
      </div>
    </ActionForm>
  );
}
