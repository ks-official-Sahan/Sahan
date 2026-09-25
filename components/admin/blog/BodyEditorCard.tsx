"use client";

import { useState } from "react";

import { cardClass } from "@/components/admin/ui/styles";
import { htmlToMarkdown, markdownToHtml } from "@/lib/blog/markdown";
import { cn } from "@/lib/utils";

import RichEditor from "./RichEditorField";
import MarkdownField from "./MarkdownField";
import PostPreviewPane from "./PostPreviewPane";

export type BodyMode = "visual" | "markdown" | "split";

// The "Body" card: Visual | Markdown | Split tabs (work item 3). `content`
// (HTML) stays the single source of truth passed up to the parent form —
// Markdown mode is a local, lossy-enough view over it (lib/blog/markdown.ts),
// re-synced from `content` on every switch into it so it can never drift
// stale. Split shows an editor (Visual or Markdown, picked with the small
// sub-toggle) alongside PostPreviewPane — the exact same preview component
// and HTML pipeline as the top bar's whole-post Preview toggle and the
// public post page (work item 4: "share one component/function").

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
  // Which editor Split pairs with — remembered independently of `mode` so
  // flipping in and out of Split doesn't lose the choice.
  const [splitEditor, setSplitEditor] = useState<"visual" | "markdown">("visual");
  const showingMarkdown = mode === "markdown" || (mode === "split" && splitEditor === "markdown");

  const [markdownText, setMarkdownText] = useState(() => (showingMarkdown ? htmlToMarkdown(content) : ""));
  // Re-seed only on a transition into a Markdown-showing state, from `content`
  // at that moment. Tracking every `content` change would fight the
  // textarea's own edits (each keystroke round-tripping through HTML).
  // Adjusted during render (React's "store info from previous renders"
  // pattern), so the textarea never paints one frame of stale text.
  const [wasShowingMarkdown, setWasShowingMarkdown] = useState(showingMarkdown);
  if (showingMarkdown !== wasShowingMarkdown) {
    setWasShowingMarkdown(showingMarkdown);
    if (showingMarkdown) setMarkdownText(htmlToMarkdown(content));
  }

  const tabs: { value: BodyMode; label: string }[] = [
    { value: "visual", label: "Visual" },
    { value: "markdown", label: "Markdown" },
    { value: "split", label: "Split" },
  ];

  return (
    <div className={cardClass}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium">Body</span>
        <div className="flex items-center gap-2">
          {mode === "split" ? (
            <div role="tablist" aria-label="Split editor" className="inline-flex rounded-md border border-input p-0.5">
              {(["visual", "markdown"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={splitEditor === option}
                  onClick={() => setSplitEditor(option)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                    splitEditor === option ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}
          <div role="tablist" aria-label="Body editing mode" className="inline-flex rounded-md border border-input p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={mode === tab.value}
                onClick={() => onModeChange(tab.value)}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium transition-colors",
                  mode === tab.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={cn(mode === "split" ? "grid gap-4 lg:grid-cols-2" : undefined)}>
        <div>
          {showingMarkdown ? (
            <MarkdownField
              value={markdownText}
              onChange={(next) => {
                setMarkdownText(next);
                onChange(markdownToHtml(next));
              }}
              placeholder="## Heading&#10;&#10;Write in Markdown…"
            />
          ) : (
            <RichEditor value={content} onChange={onChange} />
          )}
        </div>
        {mode === "split" ? (
          <PostPreviewPane post={{ title: "", excerpt: "", topic: "", coverSrc: null, coverAlt: "", html: content }} chrome={false} />
        ) : null}
      </div>
    </div>
  );
}
