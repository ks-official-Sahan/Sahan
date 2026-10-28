// Titles and descriptions as they should appear in a search result.
// The limits are the lengths Google tends to show in full.

const BRAND = "Sahan Sachintha";
export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 110;
export const DESCRIPTION_MAX = 160;

/** A progress note this short is a log line, not an article worth indexing. */
export const MIN_INDEXABLE_WORDS = 300;

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
  if (clean.length > DESCRIPTION_MAX) {
    const slice = clean.slice(0, DESCRIPTION_MAX);
    const sentence = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
    if (sentence >= 70) return slice.slice(0, sentence + 1);
    return trimWords(slice, DESCRIPTION_MAX).replace(/[,:;]\s*$/, "");
  }
  if (clean.length >= DESCRIPTION_MIN || clean.toLowerCase().includes("sahan sachintha")) return clean;
  const joined = `${clean.replace(/[.?!]\s*$/, "")}. ${attribution}`.replace(/\s+/g, " ");
  return joined.length <= DESCRIPTION_MAX ? joined : trimWords(joined, DESCRIPTION_MAX);
}
