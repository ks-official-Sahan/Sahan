// Titles and descriptions as they should appear in a search result.
// The limits are the lengths Google tends to show in full.

const BRAND = "Sahan Sachintha";
export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 110;
export const DESCRIPTION_MAX = 160;

/** A progress note this short is a log line, not an article worth indexing. */
export const MIN_INDEXABLE_WORDS = 300;

/** Live and demo projects can be opened. The other statuses are stubs. */
const INDEXABLE_PROJECT_STATUS = new Set(["live", "demo"]);

export function isIndexableProject(status: string): boolean {
  return INDEXABLE_PROJECT_STATUS.has(status);
}

export function wordCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function isIndexableArticle(text: string): boolean {
  return wordCount(text) >= MIN_INDEXABLE_WORDS;
}

function trimWords(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  const base = (space >= Math.min(24, Math.max(8, max - 8)) ? cut.slice(0, space) : cut).replace(/[\s|:;,\-–—]+$/u, "");
  return base.length > 0 ? base : cut.trim();
}

/** Full document title, with the name when it fits, never past 60 characters. */
export function documentTitle(pageTitle: string, brand = BRAND): string {
  const clean = pageTitle.replace(/\s+/g, " ").trim().replace(/[|\s]+$/u, "");
  if (!clean) return brand;
  if (clean.toLowerCase().includes(brand.toLowerCase())) {
    return clean.length <= TITLE_MAX ? clean : trimWords(clean, TITLE_MAX);
  }
  const suffix = ` | ${brand}`;
  const branded = `${clean}${suffix}`;
  if (branded.length <= TITLE_MAX) return branded;
  return `${trimWords(clean, TITLE_MAX - suffix.length)}${suffix}`;
}

const AVAILABILITY = /not in the stores|not published|unpublished|upcoming|offline|no public|ask me for a preview/i;

function sentences(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const mark = text[i];
    if (mark !== "." && mark !== "!" && mark !== "?") continue;
    const before = text[i - 1] ?? "";
    const after = text[i + 1] ?? "";
    if (mark === "." && /\d/.test(before) && /\d/.test(after)) continue;
    if (after && !/\s/.test(after)) continue;
    parts.push(text.slice(start, i + 1).trim());
    start = i + 1;
  }
  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.filter(Boolean);
}

/** Whole sentences that fit, then a word boundary. Never a slice that ends inside a word. */
function fitSentences(text: string, max: number): string {
  const parts = sentences(text);
  let chosen = "";
  for (const part of parts) {
    const next = chosen ? `${chosen} ${part}` : part;
    if (next.length > max) break;
    chosen = next;
  }
  const availability = parts.find((part) => AVAILABILITY.test(part));
  if (availability && !chosen.includes(availability)) {
    const withStatus = `${chosen} ${availability}`.replace(/\s+/g, " ").trim();
    if (withStatus.length <= max) chosen = withStatus;
    else if (availability.length < max) {
      const room = max - availability.length - 1;
      chosen = room >= 40 ? `${trimWords(text, room)} ${availability}` : availability;
    }
  }
  if (chosen.length >= DESCRIPTION_MIN || (chosen && parts.length === 1 && chosen.length <= max)) return chosen;
  if (!chosen) return trimWords(text, max);
  return chosen;
}

/**
 * A meta description that finishes a sentence when it can.
 * A very short line gains a line about who wrote it, so the result is not a fragment.
 */
export function metaDescription(
  text: string,
  attribution = "Written by Sahan Sachintha, a full-stack software engineer at Datalake Creative in Sri Lanka."
): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return trimWords(attribution, DESCRIPTION_MAX);
  let chosen = clean.length <= DESCRIPTION_MAX ? clean : fitSentences(clean, DESCRIPTION_MAX);
  if (chosen.length > DESCRIPTION_MAX) chosen = trimWords(chosen, DESCRIPTION_MAX);
  const finished = /[.!?]$/.test(chosen) && chosen.length >= 70;
  if (chosen.length >= DESCRIPTION_MIN || finished || chosen.toLowerCase().includes("sahan sachintha")) return chosen;
  const joined = `${chosen.replace(/[.?!]\s*$/, "")}. ${attribution}`.replace(/\s+/g, " ");
  return joined.length <= DESCRIPTION_MAX ? joined : trimWords(joined, DESCRIPTION_MAX);
}
