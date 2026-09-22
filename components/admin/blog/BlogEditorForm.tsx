"use client";

import { useState } from "react";

import ActionForm, { Field, SubmitButton } from "@/components/admin/ui/ActionForm";
import { MediaPicker } from "@/components/admin/media/MediaPicker";
import type { ActionState } from "@/lib/actions/state";
import { fieldClass } from "@/components/admin/ui/styles";
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
  const [content, setContent] = useState(initial.content);
  const [coverMediaId, setCoverMediaId] = useState(initial.coverMediaId);
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [coverAlt, setCoverAlt] = useState(initial.coverAlt);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function draftWithAi() {
    const topic = window.prompt("Topic for the AI draft (this is sent to the AI helper as data, not an instruction).");
    if (!topic) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const response = await fetch("/api/admin/ai/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const data = (await response.json()) as { ok: boolean; html?: string; error?: string };
      if (!data.ok || !data.html) {
        setAiError(data.error || "The AI helper could not produce a draft.");
        return;
      }
      setContent((current) => (current ? `${current}\n${data.html}` : data.html!));
    } catch {
      setAiError("The AI helper is unreachable right now.");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <ActionForm action={action} className="space-y-6">
      {post?.id ? <input type="hidden" name="id" defaultValue={post.id} /> : null}
      <input type="hidden" name="content" value={content} />
      <input type="hidden" name="coverMediaId" value={coverMediaId} />

      <div className="grid gap-4 s768:grid-cols-2">
        <Field label="Title" name="title" defaultValue={initial.title} required maxLength={200} />
        <Field label="Slug" name="slug" defaultValue={initial.slug} required maxLength={96} hint="Lowercase letters, numbers and hyphens only." />
      </div>

      <Field label="Excerpt" name="excerpt" defaultValue={initial.excerpt} multiline maxLength={500} hint="Shown on the updates list. Falls back to the start of the body when left blank." />

      <div className="grid gap-4 s768:grid-cols-2">
        <Field label="Topic" name="topic" defaultValue={initial.topic} required maxLength={50} />
        <Field label="Tags" name="tags" defaultValue={initial.tags.join(", ")} hint="Comma separated." />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium">Body</span>
          {canUseAi ? (
            <button
              type="button"
              onClick={draftWithAi}
              disabled={aiBusy}
              className="rounded-md border border-input bg-background px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60"
            >
              {aiBusy ? "Drafting…" : "Draft with AI"}
            </button>
          ) : null}
        </div>
        {aiError ? <p className="mb-2 text-xs text-destructive">{aiError}</p> : null}
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
      </div>

      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">SEO</legend>
        <Field label="SEO title" name="seoTitle" defaultValue={initial.seoTitle} maxLength={70} hint="Falls back to the post title." />
        <Field label="SEO description" name="seoDescription" defaultValue={initial.seoDescription} multiline maxLength={200} hint="Falls back to the excerpt." />
        <Field label="Canonical URL" name="canonicalUrl" defaultValue={initial.canonicalUrl} hint="Only needed if this post was published elsewhere first." />
      </fieldset>

      <SubmitButton pendingLabel="Saving…">{post?.id ? "Save changes" : "Create draft"}</SubmitButton>
    </ActionForm>
  );
}
