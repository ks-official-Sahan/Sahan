"use client";

import { useEffect, useRef, useState } from "react";

import { cardClass } from "@/components/admin/ui/styles";
import { previewPostHtmlAction } from "@/lib/actions/blog";
import { htmlToMarkdown, markdownToHtml } from "@/lib/blog/markdown";
import { cn } from "@/lib/utils";

import RichEditor from "./RichEditorField";
import MarkdownField from "./MarkdownField";

export type BodyMode = "visual" | "markdown";

// The "Body" card: a Visual (TipTap) / Markdown toggle on the left half and
// a live preview on the right half, matching the reference layout. `content`
// (HTML) stays the single source of truth passed up to the parent form —
// Markdown mode is a local, lossy-enough view over it (lib/blog/markdown.ts),
// re-synced from `content` on every mode switch so it can never drift stale.
// The preview calls previewPostHtmlAction (lib/actions/blog.ts), which runs
// the exact sanitizeRich() the public /updates/[slug] page renders with, so
// "what you see is what ships" rather than a client-side approximation.

export default function BodyEditorCard({
  content,
  onChange,
  mode,
  onModeChange,
}: {
  content: string;
  onChange: (html: string) => void;
  mode: BodyMode;
  onModeChange: (mode: BodyMode) => void;
}) {
  const [markdownText, setMarkdownText] = useState(() => htmlToMarkdown(content));
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewPending, setPreviewPending] = useState(false);

  useEffect(() => {
    if (mode === "markdown") setMarkdownText(htmlToMarkdown(content));
    // Re-seed only on a mode transition into Markdown, using `content` at that
    // moment — depending on `content` too would fight with the textarea's own
    // edits (every keystroke round-tripping through HTML).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Debounced live preview: calls the server action (the real sanitizer)
  // instead of approximating it client-side.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    setPreviewPending(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const html = await previewPostHtmlAction(content);
        setPreviewHtml(html);
      } finally {
        setPreviewPending(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [content]);

  return (
    <div className={cardClass}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Body</span>
        <div role="tablist" aria-label="Body editing mode" className="inline-flex rounded-md border border-input p-0.5">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "visual"}
            onClick={() => onModeChange("visual")}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              mode === "visual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Visual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "markdown"}
            onClick={() => onModeChange("markdown")}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              mode === "markdown" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Markdown
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          {mode === "visual" ? (
            <RichEditor value={content} onChange={onChange} />
          ) : (
            <MarkdownField
              value={markdownText}
              onChange={(next) => {
                setMarkdownText(next);
                onChange(markdownToHtml(next));
              }}
              placeholder="## Heading&#10;&#10;Write in Markdown…"
            />
          )}
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            Live preview
            {previewPending ? <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" /> : null}
          </div>
          <div
            className="prose prose-sm min-h-[320px] max-w-none overflow-auto rounded-md border border-input bg-background px-3 py-2"
            // previewHtml comes from previewPostHtmlAction, which runs the
            // same sanitizeRich() the public site renders with.
            dangerouslySetInnerHTML={{ __html: previewHtml || "<p class=\"text-muted-foreground\">Nothing to preview yet.</p>" }}
          />
        </div>
      </div>
    </div>
  );
}
