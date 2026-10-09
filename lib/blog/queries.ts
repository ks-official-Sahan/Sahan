import "server-only";

import { cached } from "@/lib/cache/cached";
import { loadOrNull } from "@/lib/cache/fallback";
import { isValidPostSlug, TAGS } from "@/lib/cache/tags";
import { repos } from "@/lib/data";
import { extractText, sanitizeRich } from "@/lib/cms/rich-text";
import { log } from "@/lib/log";
import { UpdatesContent } from "@/contents/updates";

import { computeReadMinutes } from "@sahan-sac/blog-kit/readtime";
import { ensureUniqueSlug, slugify } from "@sahan-sac/blog-kit/slug";

// Public reads of blog posts (docs/plan/admin-cms-adr.md, Step 12, tag
// `blog:list` / `blog:post:<slug>`). Only PUBLISHED rows are ever read here:
// a SCHEDULED post becomes visible only once lib/cron/jobs.ts's
// blogPublishJob (or a manual publish) actually promotes its status, never by
// comparing `publishAt` to "now" in this loader.
//
// Two cached reads, so neither grows with the size of every post body:
// - the list holds summaries only (no HTML, no full text), which keeps the
//   cache entry far below the data cache's 2 MB per-entry limit;
// - one post's body is read and cached per slug, and `contentHtml` is re-run
//   through sanitizeRich() before it leaves this file, so a row written
//   before the allowlist tightened, or edited directly in the database, is
//   never trusted as-is.

export interface BlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  topic: string;
  tags: string[];
  date: string;
  publishedAt: string | null;
  /** Last edit, for dateModified/lastModified. Null for the built-in defaults. */
  updatedAt: string | null;
  readMinutes: number;
  coverUrl?: string;
  coverAlt?: string;
  coverWidth?: number;
  coverHeight?: number;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  authorName?: string;
  /** Published but kept out of search engines, the sitemap, RSS and llms.txt. */
  noindex?: boolean;
}

export interface BlogPostView extends BlogPostSummary {
  contentHtml: string;
  contentText: string;
}

const EXCERPT_CHARS = 200;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);

/** `UpdatesContent.posts` adapted to the public shape, used only while the table is empty. */
export function defaultPosts(): BlogPostView[] {
  const taken = new Set<string>();
  return UpdatesContent.posts.map((post) => {
    const slug = ensureUniqueSlug(slugify(post.title) || post.id, taken);
    taken.add(slug);
    const html = sanitizeRich(`<p>${escapeHtml(post.content)}</p>`);
    return {
      id: post.id,
      slug,
      title: post.title,
      excerpt: post.content.slice(0, EXCERPT_CHARS),
      contentHtml: html,
      contentText: post.content,
      topic: post.topic,
      tags: post.tags,
      date: post.date,
      publishedAt: null,
      updatedAt: null,
      readMinutes: computeReadMinutes(post.content),
    };
  });
}

interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentText: string;
  topic: string;
  tags: string[];
  publishAt: Date | string | null;
  publishedAt: Date | string | null;
  updatedAt: Date | string;
  readMinutes: number;
  coverMedia: { url: string; width: number | null; height: number | null } | null;
  coverAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  author: { name: string | null } | null;
}

interface FullPostRow extends PostRow {
  contentHtml: string;
}

// Dates are coerced, not trusted as Date instances: a cache hit off the Redis
// read-through in lib/cache/cached.ts round-trips through JSON, which turns
// Date into an ISO string. new Date() on an already-Date value is a no-op.
function toSummary(row: PostRow): BlogPostSummary {
  const effectiveDate = row.publishAt ?? row.publishedAt;
  const publishedAt = effectiveDate ? new Date(effectiveDate) : null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || row.contentText.slice(0, EXCERPT_CHARS),
    topic: row.topic,
    tags: row.tags,
    date: publishedAt ? formatDate(publishedAt) : "",
    publishedAt: publishedAt ? publishedAt.toISOString() : null,
    updatedAt: new Date(row.updatedAt).toISOString(),
    readMinutes: row.readMinutes,
    coverUrl: row.coverMedia?.url,
    coverAlt: row.coverAlt || undefined,
    coverWidth: row.coverMedia?.width ?? undefined,
    coverHeight: row.coverMedia?.height ?? undefined,
    seoTitle: row.seoTitle || undefined,
    seoDescription: row.seoDescription || undefined,
    canonicalUrl: row.canonicalUrl || undefined,
    authorName: row.author?.name || undefined,
    noindex: row.noindex || undefined,
  };
}

function toView(row: FullPostRow): BlogPostView {
  return {
    ...toSummary(row),
    // Re-sanitized: never trust a stored value, even one this loader wrote itself.
    contentHtml: sanitizeRich(row.contentHtml),
    contentText: row.contentText || extractText(row.contentHtml),
  };
}

// Scheduled posts become public at publishAt even when the daily promotion
// cron is delayed. The cron still normalizes status and performs durable cache
// invalidation; this read-time rule bounds the user-visible delay.
const cachedSummaries = cached(async () => (await repos.posts.listPublished()).map(toSummary), ["blog", "list", "v4"], {
  tags: [TAGS.blogList],
  revalidate: 300,
});

function cachedPost(slug: string) {
  return cached((): Promise<FullPostRow | null> => repos.posts.findPublished(slug), ["blog", "post", slug], {
    tags: [TAGS.blogPost(slug)],
    revalidate: 300,
  });
}

// Every public slug in one small cached read: a detail lookup for an unknown
// slug is answered from it, so crawlers probing random /updates/<slug> or
// /api/content/v1/posts/<slug> URLs never reach the database or create a
// cache entry per guess.
const cachedPublicSlugs = cached(() => repos.posts.listPublicSlugs(), ["blog", "public-slugs", "v1"], {
  tags: [TAGS.blogList],
  revalidate: 300,
});

const cachedPublicPostCount = cached(() => repos.posts.countPublished(), ["blog", "public-count", "v1"], {
  tags: [TAGS.blogList],
  revalidate: 300,
});

export interface PublicPostCursor {
  publishedAt: string;
  id: string;
}

export interface PublicPostPage {
  items: BlogPostSummary[];
  nextCursor: PublicPostCursor | null;
}

export function encodePublicPostCursor(cursor: PublicPostCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

/** undefined means no cursor; null means malformed. */
export function decodePublicPostCursor(value: string | null): PublicPostCursor | undefined | null {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { id?: unknown; publishedAt?: unknown };
    if (typeof parsed.id !== "string" || !/^[\w-]{1,96}$/.test(parsed.id) || typeof parsed.publishedAt !== "string") return null;
    const date = new Date(parsed.publishedAt);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== parsed.publishedAt) return null;
    return { id: parsed.id, publishedAt: parsed.publishedAt };
  } catch {
    return null;
  }
}

/** Bounded, cached keyset page for the headless API and large archives. */
async function getPostPage(
  limit: number,
  after: PublicPostCursor | undefined,
  indexableOnly: boolean,
  maxLimit: number
): Promise<PublicPostPage> {
  const safeLimit = Math.max(1, Math.min(maxLimit, Math.trunc(limit)));
  const date = after ? new Date(after.publishedAt) : undefined;
  const cursor = after && date && Number.isFinite(date.getTime()) ? { publishedAt: date, id: after.id } : undefined;
  const read = cached(
    () => repos.posts.listPublishedPage(safeLimit + 1, cursor, indexableOnly),
    ["blog", "page", indexableOnly ? "indexable" : "all", String(safeLimit), cursor?.publishedAt.toISOString() ?? "first", cursor?.id ?? "first"],
    { tags: [TAGS.blogList], revalidate: 300 }
  );
  const rows = await loadOrNull(read, {
    onError: (error) => log.warn("blog page read failed during build, using defaults", { error: String(error) }),
  });
  if (!rows) {
    if (after) return { items: [], nextCursor: null };
    const items = defaultPosts().slice(0, safeLimit).map(({ contentHtml: _html, contentText: _text, ...post }) => post);
    return { items: indexableOnly ? items.filter((post) => !post.noindex) : items, nextCursor: null };
  }
  if (rows.length === 0 && !after) {
    const publicCount = indexableOnly ? await loadOrNull(cachedPublicPostCount) : 0;
    if (indexableOnly && publicCount !== null && publicCount > 0) return { items: [], nextCursor: null };
    const items = defaultPosts().slice(0, safeLimit).map(({ contentHtml: _html, contentText: _text, ...post }) => post);
    return { items, nextCursor: null };
  }
  if (rows.length === 0) return { items: [], nextCursor: null };

  const hasMore = rows.length > safeLimit;
  const page = rows.slice(0, safeLimit);
  const last = page.at(-1);
  const effectiveDate = last?.publishAt ?? last?.publishedAt ?? null;
  return {
    items: page.map(toSummary),
    nextCursor: hasMore && last && effectiveDate ? { publishedAt: new Date(effectiveDate).toISOString(), id: last.id } : null,
  };
}

/** Bounded public page for the archive and headless API. */
export function getPublicPostPage(limit: number, after?: PublicPostCursor): Promise<PublicPostPage> {
  return getPostPage(limit, after, false, 50);
}

/** Bounded page of published posts that should be indexed by search engines. */
export function getIndexablePostPage(limit: number, after?: PublicPostCursor): Promise<PublicPostPage> {
  return getPostPage(limit, after, true, 1_000);
}

async function collectRecentPosts(
  limit: number,
  readPage: (limit: number, after?: PublicPostCursor) => Promise<PublicPostPage>
): Promise<BlogPostSummary[]> {
  const safeLimit = Math.max(1, Math.min(10_000, Math.trunc(limit)));
  const items: BlogPostSummary[] = [];
  let cursor: PublicPostCursor | undefined;
  while (items.length < safeLimit) {
    const page = await readPage(Math.min(50, safeLimit - items.length), cursor);
    items.push(...page.items);
    if (!page.nextCursor || page.items.length === 0) break;
    if (cursor && page.nextCursor.id === cursor.id && page.nextCursor.publishedAt === cursor.publishedAt) break;
    cursor = page.nextCursor;
  }
  return items.slice(0, safeLimit);
}

/** Small bounded summary for feeds, article recommendations, previews and crawler context. */
export function getRecentPosts(limit = 20): Promise<BlogPostSummary[]> {
  return collectRecentPosts(limit, getPublicPostPage);
}

/** Bounded indexable subset for RSS, llms.txt, chat context and IndexNow. */
export function getRecentIndexablePosts(limit = 20): Promise<BlogPostSummary[]> {
  return collectRecentPosts(limit, getIndexablePostPage);
}

/** Stored summaries, or null when the table is empty or unreadable (build without a database). */
async function publishedSummaries(): Promise<BlogPostSummary[] | null> {
  const rows = await loadOrNull(cachedSummaries, {
    onError: (error) => log.warn("blog posts read failed during build, using defaults", { error: String(error) }),
  });
  return rows && rows.length > 0 ? rows : null;
}

/**
 * Published posts, newest first, without bodies. Falls back to
 * `UpdatesContent.posts` only when the Post table is empty (not configured, a
 * build-time failure, or genuinely zero rows) — same fallback rule as the
 * works collections.
 */
export async function getPosts(defaults?: BlogPostView[]): Promise<BlogPostSummary[]> {
  return (await publishedSummaries()) ?? defaults ?? defaultPosts();
}

/** Published posts search engines and AI crawlers may see: the sitemap, RSS and llms.txt. */
export async function getIndexablePosts(): Promise<BlogPostSummary[]> {
  return (await getPosts()).filter((post) => !post.noindex);
}

/**
 * One published post with its body, or null. Unknown slugs are answered from
 * the cached public slug list (no per-guess cache entry); with no posts stored
 * or the database unreachable, the code defaults answer instead.
 */
export async function getPostBySlug(slug: string, defaults?: BlogPostView[]): Promise<BlogPostView | null> {
  if (!isValidPostSlug(slug)) return null;
  const slugs = await loadOrNull(cachedPublicSlugs, {
    onError: (error) => log.warn("blog slug list read failed", { error: String(error) }),
  });
  if (!slugs || slugs.length === 0) return (defaults ?? defaultPosts()).find((post) => post.slug === slug) ?? null;
  if (!slugs.includes(slug)) return null;

  const row = await loadOrNull(cachedPost(slug), {
    onError: (error) => log.warn("blog post read failed", { slug, error: String(error) }),
  });
  return row ? toView(row) : null;
}

/** Up to `limit` other posts sharing the most tags/topic with `post`, newest first on ties. */
export function relatedPosts(post: BlogPostSummary, posts: BlogPostSummary[], limit = 3): BlogPostSummary[] {
  const tags = new Set(post.tags);
  return posts
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate, index) => ({
      candidate,
      index,
      score: candidate.tags.filter((tag) => tags.has(tag)).length + (candidate.topic === post.topic ? 1 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

export interface TaxonomyEntry {
  name: string;
  count: number;
}

/** Topics and tags computed from the posts actually shown, so a filter never advertises something absent. */
export function taxonomyOf(posts: BlogPostSummary[]): { topics: TaxonomyEntry[]; tags: TaxonomyEntry[] } {
  const topicCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  for (const post of posts) {
    topicCounts.set(post.topic, (topicCounts.get(post.topic) ?? 0) + 1);
    for (const tag of post.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  return {
    topics: [...topicCounts.entries()].map(([name, count]) => ({ name, count })),
    tags: [...tagCounts.entries()].map(([name, count]) => ({ name, count })),
  };
}
