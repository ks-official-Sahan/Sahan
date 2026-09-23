"use client";

import { useState } from "react";

import ActionForm, { Field, SubmitButton } from "@/components/admin/ui/ActionForm";
import { MediaPicker } from "@/components/admin/media/MediaPicker";
import type { ActionState } from "@/lib/actions/state";
import { fieldClass, textareaClass } from "@/components/admin/ui/styles";
import { slugify } from "@/lib/blog/slug";
import { cn } from "@/lib/utils";

import RichEditor from "./RichEditorField";

// The blog post editor form: create and update share this component. Status
// changes (publish/schedule/unpublish/archive/delete) are separate forms on
// the detail page, gated on publishBlog/deleteBlog rather than editBlog
// (docs/plan/admin-cms-adr.md, Step 12).

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
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
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
};

const AI_TONES = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "technical", label: "Technical" },
  { value: "enthusiastic", label: "Enthusiastic" },
] as const;

const AI_LENGTHS = [
  { value: "short", label: "Short (~400 words)" },
  { value: "medium", label: "Medium (~800 words)" },
  { value: "long", label: "Long (~1400 words)" },
] as const;

type AiTone = (typeof AI_TONES)[number]["value"];
type AiLength = (typeof AI_LENGTHS)[number]["value"];

type FullPostResponse = {
  ok: boolean;
  title?: string;
  excerpt?: string;
  topic?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  content?: string;
  error?: string;
};

type CoverPromptResponse = { ok: boolean; prompt?: string; error?: string };

/** These AI routes return `null` bodies for 403/404/429 (permission/origin/rate-limit) and JSON only for 200/400/502, so parsing is content-type gated and failure tolerant rather than assumed. */
async function readAiJson<T>(response: Response): Promise<T | null> {
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function aiErrorMessage(response: Response, data: { error?: string } | null, fallback: string): string {
  if (response.status === 429) return "Too many AI requests. Wait a minute and try again.";
  if (response.status === 403) return "That request was blocked. Refresh the page and try again.";
  return data?.error || fallback;
}

export default function BlogEditorForm({
  action,
  post,
  canUseAi,
}: {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  post?: EditablePost;
  canUseAi: boolean;
}) {
  const initial = post ?? EMPTY_POST;
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [topic, setTopic] = useState(initial.topic);
  const [tagsText, setTagsText] = useState(initial.tags.join(", "));
  const [content, setContent] = useState(initial.content);
  const [coverMediaId, setCoverMediaId] = useState(initial.coverMediaId);
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [coverAlt, setCoverAlt] = useState(initial.coverAlt);
  const [seoTitle, setSeoTitle] = useState(initial.seoTitle);
  const [seoDescription, setSeoDescription] = useState(initial.seoDescription);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState<AiTone>("professional");
  const [aiLength, setAiLength] = useState<AiLength>("medium");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [coverPromptBusy, setCoverPromptBusy] = useState(false);
  const [coverPromptError, setCoverPromptError] = useState<string | null>(null);
  const [coverPromptSuggestion, setCoverPromptSuggestion] = useState<string | null>(null);

  async function generateFullPost() {
    if (!aiPrompt.trim()) {
      setAiError("Describe what the post should cover first.");
      return;
    }
    if ((title.trim() || content.trim()) && !window.confirm("This replaces the current title and body with the AI's draft. Continue?")) {
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      const response = await fetch("/api/admin/ai/generate-full", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, tone: aiTone, length: aiLength }),
      });
      const data = await readAiJson<FullPostResponse>(response);
      if (!response.ok || !data?.ok) {
        setAiError(aiErrorMessage(response, data, "The AI helper could not produce a draft."));
        return;
      }
      if (data.title) {
        setTitle(data.title);
        if (!slug.trim()) setSlug(slugify(data.title));
      }
      if (data.excerpt) setExcerpt(data.excerpt);
      if (data.topic && !topic.trim()) setTopic(data.topic);
      if (data.tags?.length) setTagsText(data.tags.join(", "));
      if (data.seoTitle) setSeoTitle(data.seoTitle);
      if (data.seoDescription) setSeoDescription(data.seoDescription);
      if (data.content) setContent(data.content);
    } catch {
      setAiError("The AI helper is unreachable right now.");
    } finally {
      setAiBusy(false);
    }
  }

  async function suggestCoverPrompt() {
    const topicForPrompt = title.trim() || aiPrompt.trim();
    if (!topicForPrompt) {
      setCoverPromptError("Add a title first.");
      return;
    }
    setCoverPromptBusy(true);
    setCoverPromptError(null);
    try {
      const response = await fetch("/api/admin/ai/cover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: topicForPrompt }),
      });
      const data = await readAiJson<CoverPromptResponse>(response);
      if (!response.ok || !data?.ok || !data.prompt) {
        setCoverPromptError(aiErrorMessage(response, data, "Could not suggest an image prompt."));
        return;
      }
      setCoverPromptSuggestion(data.prompt);
    } catch {
      setCoverPromptError("The AI helper is unreachable right now.");
    } finally {
      setCoverPromptBusy(false);
    }
  }

  return (
    <ActionForm action={action} className="space-y-6">
      {post?.id ? <input type="hidden" name="id" defaultValue={post.id} /> : null}
      <input type="hidden" name="content" value={content} />
      <input type="hidden" name="coverMediaId" value={coverMediaId} />

      {canUseAi ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <span className="text-sm font-medium">AI Assistant</span>
          <p className="text-xs text-muted-foreground">
            Describe what to write about. The assistant fills in the title, slug, excerpt, tags, SEO fields and body.
          </p>
          <textarea
            className={cn(textareaClass, "min-h-20")}
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            maxLength={2000}
            placeholder="E.g., Write a post about debugging memory leaks in Node.js services."
            aria-label="What the AI assistant should write about"
          />
          <div className="grid gap-3 s768:grid-cols-2">
            <div>
              <label htmlFor="ai-tone" className="text-xs font-medium text-muted-foreground">
                Tone
              </label>
              <select
                id="ai-tone"
                className={cn(fieldClass, "mt-1")}
                value={aiTone}
                onChange={(event) => setAiTone(event.target.value as AiTone)}
              >
                {AI_TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ai-length" className="text-xs font-medium text-muted-foreground">
                Length
              </label>
              <select
                id="ai-length"
                className={cn(fieldClass, "mt-1")}
                value={aiLength}
                onChange={(event) => setAiLength(event.target.value as AiLength)}
              >
                {AI_LENGTHS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {aiError ? <p className="text-xs text-destructive">{aiError}</p> : null}
          <button
            type="button"
            onClick={generateFullPost}
            disabled={aiBusy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {aiBusy ? "Generating…" : "Generate full post"}
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 s768:grid-cols-2">
        <Field label="Title" name="title" value={title} onChange={setTitle} required maxLength={200} />
        <Field
          label="Slug"
          name="slug"
          value={slug}
          onChange={setSlug}
          required
          maxLength={96}
          hint="Lowercase letters, numbers and hyphens only."
        />
      </div>

      <Field
        label="Excerpt"
        name="excerpt"
        value={excerpt}
        onChange={setExcerpt}
        multiline
        maxLength={500}
        hint="Shown on the updates list. Falls back to the start of the body when left blank."
      />

      <div className="grid gap-4 s768:grid-cols-2">
        <Field label="Topic" name="topic" value={topic} onChange={setTopic} required maxLength={50} />
        <Field label="Tags" name="tags" value={tagsText} onChange={setTagsText} hint="Comma separated." />
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium">Body</span>
        <RichEditor value={content} onChange={setContent} />
      </div>

      <div>
        <span className="text-sm font-medium">Cover image</span>
        <div className="mt-1.5 flex items-center gap-3">
          <MediaPicker
            kind="IMAGE"
            onSelect={(result) => {
              setCoverMediaId(result.mediaId);
              setCoverSrc(result.src);
              if (!coverAlt) setCoverAlt(result.alt);
            }}
          />
          {coverSrc ? <img src={coverSrc} alt="" className="h-12 w-20 rounded object-cover" /> : null}
        </div>
        <label htmlFor="coverAlt" className="mt-3 block text-sm font-medium">
          Cover alt text
        </label>
        <input
          id="coverAlt"
          className={cn(fieldClass, "mt-1.5")}
          value={coverAlt}
          onChange={(event) => setCoverAlt(event.target.value)}
          maxLength={200}
        />
        <input type="hidden" name="coverAlt" value={coverAlt} />

        {canUseAi ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={suggestCoverPrompt}
              disabled={coverPromptBusy}
              className="rounded-md border border-input bg-background px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60"
            >
              {coverPromptBusy ? "Thinking…" : "Suggest image prompt"}
            </button>
            {coverPromptError ? <p className="mt-1 text-xs text-destructive">{coverPromptError}</p> : null}
            {coverPromptSuggestion ? (
              <p className="mt-1 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                {coverPromptSuggestion}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">SEO</legend>
        <Field
          label="SEO title"
          name="seoTitle"
          value={seoTitle}
          onChange={setSeoTitle}
          maxLength={70}
          hint="Falls back to the post title."
        />
        <Field
          label="SEO description"
          name="seoDescription"
          value={seoDescription}
          onChange={setSeoDescription}
          multiline
          maxLength={200}
          hint="Falls back to the excerpt."
        />
        <Field
          label="Canonical URL"
          name="canonicalUrl"
          defaultValue={initial.canonicalUrl}
          hint="Only needed if this post was published elsewhere first."
        />
      </fieldset>

      <SubmitButton pendingLabel="Saving…">{post?.id ? "Save changes" : "Create draft"}</SubmitButton>
    </ActionForm>
  );
}
