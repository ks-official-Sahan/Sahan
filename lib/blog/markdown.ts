import { marked } from "marked";
import TurndownService from "turndown";

// Markdown <-> HTML conversion for the blog editor's Visual/Markdown toggle
// and for AI-generated post bodies (lib/ai/blog-generate.ts). `content`
// stays the source of truth as TipTap-compatible HTML — this matches the
// existing Post model (`content` is "Editor HTML as saved by TipTap") and
// the public renderer (lib/cms/rich-text.ts's sanitizeRich, run again on
// every save and every public read) — Markdown is only ever an edit-time
// representation, converted losslessly enough for the tag set sanitizeRich
// allows: p, br, hr, h2-h4, ul/ol/li, strong/b, em/i, s, code/pre,
// blockquote, a, img.
//
// marked + turndown were picked over TipTap's own markdown extension
// (no @tiptap/*-markdown package exists for TipTap 3 in this repo's
// dependency set): both are small, dependency-free, and run identically on
// the client (mode toggle) and the server (the AI generation route), so the
// same two functions are the single source of truth for the conversion
// instead of duplicating it per environment.

// GFM strikethrough renders as <s> (not <del>) so the output matches both
// what TipTap's Strike mark produces and what sanitizeRich's allowlist
// accepts (it allows "s", not "del").
const renderer = new marked.Renderer();
const originalDel = renderer.del.bind(renderer);
renderer.del = (token) => originalDel(token).replace(/^<del>/, "<s>").replace(/<\/del>$/, "</s>");

marked.setOptions({ gfm: true, breaks: false });

/**
 * Markdown to HTML for the Visual editor / live preview. A stray `#` H1 (the
 * model should never repeat the title as a heading, but nothing enforces
 * that upstream) is downgraded to H2 rather than silently dropped by
 * sanitizeRich, whose allowlist starts at H2.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return "";
  const html = marked.parse(markdown, { async: false, renderer }) as string;
  return html.replace(/<h1(\s[^>]*)?>/gi, "<h2>").replace(/<\/h1>/gi, "</h2>").trim();
}

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
});

// Turndown has no built-in GFM strikethrough rule; <s> is what this editor
// and sanitizeRich's allowlist use (see the marked.Renderer override above).
turndown.addRule("strikethrough", {
  filter: (node) => ["S", "DEL", "STRIKE"].includes(node.nodeName),
  replacement: (content) => `~~${content}~~`,
});

/** HTML to Markdown for the Markdown editor mode. */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return "";
  return turndown.turndown(html).trim();
}
