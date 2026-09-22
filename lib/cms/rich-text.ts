import "server-only";

import sanitizeHtml from "sanitize-html";

import { isSafeHref } from "./href";

// The one HTML allowlist for blog post bodies, used both when an editor saves
// a post (lib/actions/blog.ts) and again by the public loader (lib/blog/queries.ts)
// before render, so a value written before a rule tightened, or a row edited
// directly in the database, is never trusted as-is
// (docs/plan/admin-cms-adr.md, Step 12, decision D12).

const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "a",
  "img",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "title"],
  img: ["src", "alt", "title", "width", "height"],
};

/**
 * Sanitizes editor HTML for public rendering. Strips script tags, event
 * handler attributes, `javascript:` and other unsafe hrefs, iframes and
 * inline style, and drops any image without a safe `src` or a non-empty
 * `alt` (alt is required wherever an image is used). Anchors with an unsafe
 * `href` are unwrapped to plain text rather than dropped, so the surrounding
 * sentence still reads.
 */
export function sanitizeRich(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["https", "mailto", "tel"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (_tagName, attribs) => {
        if (typeof attribs.href === "string" && isSafeHref(attribs.href)) {
          return {
            tagName: "a",
            attribs: {
              href: attribs.href,
              ...(attribs.title ? { title: attribs.title } : {}),
            },
          };
        }
        // An unsafe or missing href: keep the text, drop the link.
        return { tagName: "span", attribs: {} };
      },
    },
    exclusiveFilter: (frame) => {
      if (frame.tag !== "img") return false;
      const src = frame.attribs.src;
      const alt = frame.attribs.alt;
      return !src || !isSafeHref(src) || !alt || !alt.trim();
    },
  }).trim();
}

/** Plain text extracted from sanitized HTML, for search and read-time. */
export function extractText(html: string): string {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  return text.replace(/\s+/g, " ").trim();
}
