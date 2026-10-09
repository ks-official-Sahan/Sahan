// Placeholder image tokens the AI-generated Markdown body uses in place of a
// real media URL (lib/ai/blog-prompts.ts's contentImageToken) until the
// image itself finishes generating (lib/ai/image.ts) — or forever, if image
// generation is unavailable or the attempt fails. Pure and isomorphic (no
// "server-only"): the admin's browser calls this as each streamed `image`
// event arrives (components/admin/blog/AiAssistantCard.tsx) to update the
// Markdown source of truth, which is then re-rendered to HTML.

export interface ResolvedImage {
  url: string;
  alt: string;
  caption?: string;
}

/** Escapes a string for safe use inside a RegExp built from it. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces every occurrence of `token` in a Markdown body with either the
 * resolved image's real URL (generation succeeded — the surrounding
 * `![alt](url "caption")` now points at a real media asset) or a short,
 * clearly-labelled placeholder note in its place (generation is unavailable
 * or failed), so the admin gets a prompt to fill it in from the library
 * instead of a dead `<img>` tag.
 */
/** Removes every `![alt](token "caption")` image that uses `token`, with its line, for a post whose inline images are turned off. */
export function removeImageToken(markdown: string, token: string): string {
  if (!markdown.includes(token)) return markdown;
  const pattern = new RegExp(`[ \\t]*!\\[[^\\]]*\\]\\(${escapeRegExp(token)}(?:\\s+"[^"]*")?\\)[ \\t]*\\n?`, "g");
  return markdown.replace(pattern, "").replace(/\n{3,}/g, "\n\n");
}

export function applyImageToken(markdown: string, token: string, resolved: ResolvedImage | null): string {
  if (!markdown.includes(token)) return markdown;
  if (resolved) return markdown.split(token).join(resolved.url);

  const pattern = new RegExp(`!\\[([^\\]]*)\\]\\(${escapeRegExp(token)}(?:\\s+"[^"]*")?\\)`, "g");
  return markdown.replace(pattern, (_match, alt: string) => {
    const label = alt || "image";
    return `*(Add an image here — ${label}. Use "Choose from library" or the AI Image Prompt to fill it in.)*`;
  });
}

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * applyImageToken for the editor's HTML instead of the Markdown source, so an
 * image that finishes after the draft has landed patches the body the admin
 * may already be editing instead of re-rendering over it. Handles both shapes
 * a token takes there: markdownToHtml's <figure><img><figcaption></figure>,
 * and the bare <img> the rich editor normalizes it to once edited.
 */
export function applyImageTokenToHtml(html: string, token: string, resolved: ResolvedImage | null): string {
  const src = `src="${escapeAttribute(token)}"`;
  if (!html.includes(src)) return html;
  if (resolved) return html.split(src).join(`src="${escapeAttribute(resolved.url)}"`);

  const pattern = new RegExp(`<figure>\\s*<img\\b[^>]*\\s${escapeRegExp(src)}[^>]*>[\\s\\S]*?</figure>|<img\\b[^>]*\\s${escapeRegExp(src)}[^>]*>`, "g");
  return html.replace(pattern, (tag) => {
    const label = /\salt="([^"]*)"/.exec(tag)?.[1] || "image";
    return `<p><em>(Add an image here — ${label}. Use "Choose from library" or the AI Image Prompt to fill it in.)</em></p>`;
  });
}
