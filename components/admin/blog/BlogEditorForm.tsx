"use client";

import { type ReactNode, useState } from "react";

import ActionForm, { Field, SubmitButton } from "@/components/admin/ui/ActionForm";
import type { ActionState } from "@/lib/actions/state";
import { cardClass, fieldClass } from "@/components/admin/ui/styles";
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
    <ActionForm action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {post?.id ? <input type="hidden" name="id" defaultValue={post.id} /> : null}
      <input type="hidden" name="content" value={content} />
      <input type="hidden" name="topic" value={topic} />
      <input type="hidden" name="tags" value={tags.join(",")} />
      <input type="hidden" name="coverMediaId" value={coverMediaId} />
      <input type="hidden" name="coverAlt" value={coverAlt} />
      <input type="hidden" name="generatedByAI" value={generatedByAI ? "1" : "0"} />

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
            className={cn(fieldClass, "mt-1.5 min-h-20 py-2")}
          />

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
            className={cn(fieldClass, "mt-1.5")}
          />

          <label htmlFor="seoDescription" className="mt-3 block text-sm font-medium">
            SEO description
          </label>
          <textarea
            id="seoDescription"
            name="seoDescription"
            value={seoDescription}
            onChange={(event) => setSeoDescription(event.target.value)}
            maxLength={200}
            className={cn(fieldClass, "mt-1.5 min-h-16 py-2")}
          />

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
