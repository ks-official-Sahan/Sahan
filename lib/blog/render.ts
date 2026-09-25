import { extractChartSpec, renderChartSvg, stripTags, unescapeHtml } from "./chart";

// Presentation-time post-processing of already-sanitized post HTML, shared
// by the public post page (app/(site)/updates/[slug]/page.tsx) and the admin
// live preview (components/admin/blog/BodyEditorCard.tsx), so both render
// from the exact same pipeline (work item 4). Both inputs have already been
// through lib/cms/rich-text.ts's sanitizeRich — this module never widens
// what tags survive, it only adds a computed <svg> next to a chart figure's
// existing <table> and reads a table of contents out of the heading ids
// lib/blog/markdown.ts already baked in. Pure and isomorphic (no
// "server-only"): the admin preview calls it in the browser.

const CHART_FIGURE_RE = /<figure data-chart="(?:bar|line|pie)">[\s\S]*?<\/figure>/g;

// A wide table scrolls inside its own focusable region instead of widening
// the page. The wrapper is added here, never stored: sanitizeRich keeps
// <table> bare, so this exact tag is the only shape it can have.
const TABLE_OPEN = '<div class="post-table" role="region" aria-label="Table" tabindex="0"><table>';

/**
 * Draws each chart figure's SVG from the numbers already in its own
 * <table data-chart>, right before the table's <details> disclosure, and
 * leaves everything else untouched. A figure whose table fails to parse (a
 * value hand-edited into something non-numeric, for instance) is left as the
 * accessible table alone — degrading to "no chart drawn", never to broken
 * markup.
 */
export function renderPostContent(html: string): string {
  if (!html) return "";
  return html
    .replace(CHART_FIGURE_RE, (figureHtml) => {
      const spec = extractChartSpec(figureHtml);
      if (!spec) return figureHtml;
      const svg = renderChartSvg(spec);
      return figureHtml.includes("<details>") ? figureHtml.replace("<details>", `${svg}<details>`) : figureHtml;
    })
    .replace(/<table>/g, TABLE_OPEN)
    .replace(/<\/table>/g, "</table></div>");
}

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

const HEADING_RE = /<h([23]) id="([^"]*)">([\s\S]*?)<\/h[23]>/g;

/** A flat table of contents from a post's own h2/h3 ids (lib/blog/markdown.ts gives every heading a unique slug id). H4 is left out — too fine-grained to navigate by. */
export function extractToc(html: string): TocItem[] {
  if (!html) return [];
  const items: TocItem[] = [];
  for (const match of html.matchAll(HEADING_RE)) {
    const id = match[2];
    const text = unescapeHtml(stripTags(match[3])).trim();
    if (!id || !text) continue;
    items.push({ id, text, level: Number(match[1]) as 2 | 3 });
  }
  return items;
}
