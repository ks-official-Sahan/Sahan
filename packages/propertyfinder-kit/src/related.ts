import type { AppProperty } from "./types";

function scoreRelated(a: AppProperty, b: AppProperty): number {
  let s = 0;
  if (a.category === b.category) s += 5;
  if (a.location.name === b.location.name) s += 4;
  else if (
    a.location.fullAddress.includes(b.location.name) ||
    b.location.fullAddress.includes(a.location.name)
  ) {
    s += 2;
  }
  if (
    a.bedrooms !== undefined &&
    b.bedrooms !== undefined &&
    String(a.bedrooms) === String(b.bedrooms)
  ) {
    s += 2;
  }
  if (a.type && b.type && a.type === b.type) s += 1;
  if (a.developer && b.developer && a.developer === b.developer) s += 3;
  if (a.price_aed && b.price_aed) {
    const ratio =
      Math.min(a.price_aed, b.price_aed) / Math.max(a.price_aed, b.price_aed);
    if (ratio >= 0.7) s += 2;
    else if (ratio >= 0.5) s += 1;
  }
  return s;
}

/**
 * Deterministic related listings for internal linking + topical clustering.
 * Uses one pass over the cached inventory — keep `limit` small.
 */
export function getRelatedListings(
  current: AppProperty,
  all: AppProperty[],
  limit = 6,
): AppProperty[] {
  const others = all.filter(
    (p) => p.slug !== current.slug && p.slug !== "placeholder-slug",
  );
  if (others.length === 0) return [];

  const scored = others.map((p) => ({ p, score: scoreRelated(current, p) }));
  scored.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    const dx = x.p.pf_published_at ?? "";
    const dy = y.p.pf_published_at ?? "";
    if (dx < dy) return 1;
    if (dx > dy) return -1;
    return 0;
  });

  return scored.slice(0, limit).map((x) => x.p);
}
