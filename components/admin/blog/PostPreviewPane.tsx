"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Smartphone, Sun } from "lucide-react";

import { previewPostHtmlAction } from "@/lib/actions/blog";
import { extractToc, renderPostContent } from "@/lib/blog/render";
import { cn } from "@/lib/utils";

// The one preview surface shared by the body editor's "Split" tab and the
// top bar's whole-post "Preview" toggle (work item 4 — "share one component/
// function; do not duplicate CSS"). It runs the exact pipeline the public
// post page runs: previewPostHtmlAction (the real sanitizeRich, over the
// wire from the server) then renderPostContent (the same pure function
// app/(site)/updates/[slug]/page.tsx calls, drawing each chart's <svg> and
// leaving everything else as the sanitizer produced it) into the same
// `.post-content` CSS layer (style/globals.css). Nothing here ever executes
// a script: the HTML is sanitized before renderPostContent ever sees it, and
// renderPostContent only ever adds a computed <svg>.

export type PreviewDevice = "desktop" | "mobile";
export type PreviewTheme = "light" | "dark";

export interface PostPreviewData {
  title: string;
  excerpt: string;
  topic: string;
  coverSrc: string | null;
  coverAlt: string;
  html: string;
}

function ToggleGroup<T extends string>({ value, onChange, options }: { value: T; onChange: (next: T) => void; options: { value: T; label: string; icon: React.ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-md border border-input p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          title={option.label}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium transition-colors",
            value === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.icon}
          <span className="sr-only s640:not-sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function PostPreviewPane({ post, chrome = true, className }: { post: PostPreviewData; chrome?: boolean; className?: string }) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [theme, setTheme] = useState<PreviewTheme>("dark");
  // `source` is the editor HTML the preview was rendered from, so "pending"
  // is derived (source differs from the current HTML), never set in an effect.
  const [rendered, setRendered] = useState({ source: "", html: "", failed: false });

  useEffect(() => {
    // A newer edit cancels an older request, so a slow response can never
    // overwrite the preview of a later one.
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const sanitized = await previewPostHtmlAction(post.html);
        if (!cancelled) setRendered({ source: post.html, html: renderPostContent(sanitized), failed: false });
      } catch {
        if (!cancelled) setRendered((current) => ({ ...current, source: post.html, failed: true }));
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [post.html]);

  const pending = rendered.source !== post.html;
  const renderedHtml = rendered.html;
  const toc = extractToc(renderedHtml);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          Preview
          {pending ? <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" /> : null}
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            value={device}
            onChange={setDevice}
            options={[
              { value: "desktop", label: "Desktop", icon: <Monitor size={13} aria-hidden /> },
              { value: "mobile", label: "Mobile", icon: <Smartphone size={13} aria-hidden /> },
            ]}
          />
          <ToggleGroup
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: "Light", icon: <Sun size={13} aria-hidden /> },
              { value: "dark", label: "Dark", icon: <Moon size={13} aria-hidden /> },
            ]}
          />
        </div>
      </div>

      <div className="min-h-[320px] overflow-auto rounded-md border border-input bg-muted/20 p-3">
        <div
          className={cn(
            "mx-auto rounded-lg border border-border bg-background p-5 shadow-sm transition-[max-width] duration-200",
            device === "mobile" ? "max-w-[380px]" : "max-w-none",
            theme === "dark" ? "dark" : ""
          )}
        >
          {chrome ? (
            <header className="mb-5">
              {post.topic ? <p className="text-xs font-semibold uppercase tracking-wide text-primary">{post.topic}</p> : null}
              <h1 className="mt-1 text-balance text-2xl font-semibold leading-tight text-foreground">{post.title || "Untitled post"}</h1>
              {post.excerpt ? <p className="mt-2 text-sm text-muted-foreground">{post.excerpt}</p> : null}
              {post.coverSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview of a Cloudinary/LOCAL asset
                <img src={post.coverSrc} alt={post.coverAlt} className="mt-4 h-auto w-full rounded-md border border-border object-cover" />
              ) : null}
            </header>
          ) : null}

          {toc.length > 1 ? (
            <nav aria-label="Table of contents" className="mb-5 rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this page</p>
              <ul className="space-y-1">
                {toc.map((item) => (
                  <li key={item.id} className={item.level === 3 ? "ml-3" : undefined}>
                    <a href={`#${item.id}`} className="text-primary hover:underline">
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {rendered.failed ? (
            <p role="alert" className="mb-3 text-xs text-destructive">
              Preview could not refresh. Showing the last rendered version.
            </p>
          ) : null}
          {renderedHtml ? (
            <div className="post-content text-[15px] text-foreground" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          ) : (
            <p className="text-sm text-muted-foreground">{pending ? "Rendering preview…" : "Nothing to preview yet."}</p>
          )}
        </div>
      </div>
    </div>
  );
}
