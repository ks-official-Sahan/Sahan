"use client";

import { useRef, useState } from "react";

import { buttonVariants, fieldClass, textareaClass } from "@/components/admin/ui/styles";
import { applyImageToken } from "@/lib/blog/ai-image-tokens";
import { markdownToHtml } from "@/lib/blog/markdown";
import { cn } from "@/lib/utils";

// "AI Assistant" card: one Generate click produces a complete post (title,
// slug, excerpt, Markdown body with inline image placeholders, SEO fields,
// topic, tags, and a featured-image prompt) via
// app/api/admin/ai/generate-post/route.ts, which streams staged
// Server-Sent Events. Images are requested after the text and resolved in
// parallel (per-image progress), never blocking the text from appearing.

export type Tone = "Professional" | "Friendly" | "Technical" | "Casual";
export type Length = "Short" | "Medium" | "Long";

export type AiPatch =
  | { type: "start" }
  | { type: "meta"; title: string; slug: string; excerpt: string; seoTitle: string; seoDescription: string; topic: string; tags: string[] }
  | { type: "body"; html: string }
  | { type: "featuredAlt"; alt: string }
  | { type: "featuredImageBusy"; busy: boolean }
  | { type: "featuredImage"; mediaId: string; url: string; alt: string }
  | { type: "error"; message: string };

interface ContentImageMeta {
  token: string;
  alt: string;
  caption?: string;
}

function parseSseChunk(chunk: string): { event: string; data: unknown } | null {
  const eventMatch = chunk.match(/^event:\s*(.+)$/m);
  const dataMatch = chunk.match(/^data:\s*(.+)$/m);
  if (!eventMatch || !dataMatch) return null;
  try {
    return { event: eventMatch[1].trim(), data: JSON.parse(dataMatch[1]) };
  } catch {
    return null;
  }
}

export default function AiAssistantCard({ onPatch }: { onPatch: (patch: AiPatch) => void }) {
  const [tone, setTone] = useState<Tone>("Professional");
  const [length, setLength] = useState<Length>("Medium");
  const [imageScene, setImageScene] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bodyMarkdownRef = useRef("");
  const contentImagesRef = useRef<ContentImageMeta[]>([]);

  async function generate() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    setStatus("Writing the post…");
    onPatch({ type: "start" });

    try {
      const response = await fetch("/api/admin/ai/generate-post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, tone, length, imageScene: imageScene || undefined }),
      });

      if (!response.ok || !response.body) {
        const message = response.status === 429 ? "Too many AI requests right now — try again shortly." : "The AI assistant is unreachable right now.";
        setError(message);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawDone = false;

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");

          const parsed = parseSseChunk(raw);
          if (!parsed) continue;
          const { event, data } = parsed;

          if (event === "stage") {
            setStatus("Writing the post…");
          } else if (event === "content") {
            const payload = data as {
              title: string;
              slug: string;
              excerpt: string;
              bodyMarkdown: string;
              seoTitle: string;
              seoDescription: string;
              topic: string;
              tags: string[];
              featuredImageAlt: string;
              contentImages: ContentImageMeta[];
            };
            bodyMarkdownRef.current = payload.bodyMarkdown;
            contentImagesRef.current = payload.contentImages;
            onPatch({
              type: "meta",
              title: payload.title,
              slug: payload.slug,
              excerpt: payload.excerpt,
              seoTitle: payload.seoTitle,
              seoDescription: payload.seoDescription,
              topic: payload.topic,
              tags: payload.tags,
            });
            onPatch({ type: "body", html: markdownToHtml(payload.bodyMarkdown) });
            onPatch({ type: "featuredAlt", alt: payload.featuredImageAlt });
            setStatus("Generating images…");
          } else if (event === "image") {
            const payload = data as { which: string; status: string; url?: string; mediaId?: string; alt?: string; error?: string };
            if (payload.which === "featured") {
              if (payload.status === "start") onPatch({ type: "featuredImageBusy", busy: true });
              else {
                onPatch({ type: "featuredImageBusy", busy: false });
                if (payload.status === "done" && payload.url && payload.mediaId) {
                  onPatch({ type: "featuredImage", mediaId: payload.mediaId, url: payload.url, alt: payload.alt || "" });
                }
              }
            } else {
              // A content-image token: resolve (or placeholder) it in the
              // Markdown source and push the re-rendered HTML up.
              if (payload.status === "start") continue;
              const resolved = payload.status === "done" && payload.url ? { url: payload.url, alt: payload.alt || "" } : null;
              bodyMarkdownRef.current = applyImageToken(bodyMarkdownRef.current, payload.which, resolved);
              onPatch({ type: "body", html: markdownToHtml(bodyMarkdownRef.current) });
            }
            setStatus("Generating images…");
          } else if (event === "error") {
            const payload = data as { error: string };
            setError(payload.error);
            onPatch({ type: "error", message: payload.error });
          } else if (event === "done") {
            sawDone = true;
          }
        }
      }

      setStatus(sawDone ? "Done." : null);
    } catch {
      setError("The AI assistant is unreachable right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 text-card-foreground">
      <h2 className="mb-1 text-sm font-semibold">AI Assistant</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Describe what you want to write about. The assistant generates the whole post — title, body, SEO fields, images — then fills every field
        below.
      </p>

      <div className="grid gap-4 s640:grid-cols-2">
        <div>
          <label htmlFor="ai-tone" className="text-sm font-medium">
            Tone
          </label>
          <select id="ai-tone" className={cn(fieldClass, "mt-1.5")} value={tone} onChange={(event) => setTone(event.target.value as Tone)} disabled={busy}>
            {(["Professional", "Friendly", "Technical", "Casual"] as const).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ai-length" className="text-sm font-medium">
            Length
          </label>
          <select id="ai-length" className={cn(fieldClass, "mt-1.5")} value={length} onChange={(event) => setLength(event.target.value as Length)} disabled={busy}>
            {(["Short", "Medium", "Long"] as const).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label htmlFor="ai-image-scene" className="mt-4 block text-sm font-medium">
        Featured image / hero scene (optional)
      </label>
      <textarea
        id="ai-image-scene"
        className={cn(textareaClass, "mt-1.5 min-h-16")}
        value={imageScene}
        onChange={(event) => setImageScene(event.target.value)}
        placeholder="Short visual notes for the image (e.g. a terminal at night, a system diagram)…"
        maxLength={500}
        disabled={busy}
      />

      <label htmlFor="ai-prompt" className="mt-4 block text-sm font-medium">
        What should this post be about?
      </label>
      <div className="mt-1.5 flex items-start gap-2">
        <textarea
          id="ai-prompt"
          className={cn(textareaClass, "min-h-16 flex-1")}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="E.g., Write a post about debugging a tricky race condition in a Next.js server action…"
          maxLength={2000}
          disabled={busy}
        />
        <button
          type="button"
          onClick={generate}
          disabled={busy || !prompt.trim()}
          aria-label="Generate with AI"
          title="Generate with AI"
          className={cn(buttonVariants.primary, "h-16 w-16 shrink-0 px-0 text-lg")}
        >
          {busy ? <span aria-hidden className="animate-pulse">…</span> : <span aria-hidden>✨</span>}
        </button>
      </div>

      {status && !error ? (
        <p role="status" aria-live="polite" className="mt-2 text-xs text-muted-foreground">
          {status}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
