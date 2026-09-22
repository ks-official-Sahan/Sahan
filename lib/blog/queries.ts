import "server-only";

import { cached } from "@/lib/cache/cached";
import { loadOrNull } from "@/lib/cache/fallback";
import { TAGS } from "@/lib/cache/tags";
import { db } from "@/lib/db/prisma";
import { extractText, sanitizeRich } from "@/lib/cms/rich-text";
import { log } from "@/lib/log";
import { UpdatesContent } from "@/contents/updates";

import { computeReadMinutes } from "./readtime";
import { ensureUniqueSlug, slugify } from "./slug";

// Public reads of blog posts (docs/plan/admin-cms-adr.md, Step 12, tag
// `blog:list` / `blog:post:<slug>`). Only PUBLISHED rows are ever read here:
// a SCHEDULED post becomes visible only once lib/cron/jobs.ts's
// blogPublishJob (or a manual publish) actually promotes its status, never by
// comparing `publishAt` to "now" in this loader. `contentHtml` is re-run
// through sanitizeRich() before it leaves this file, so a row written before
// the allowlist tightened, or edited directly in the database, is never
// trusted as-is.

export interface BlogPostView {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  contentText: string;
  topic: string;
  tags: string[];
  date: string;
  publishedAt: string | null;
  readMinutes: number;
  coverUrl?: string;
  coverAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
}

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
      excerpt: post.content.slice(0, 200),
      contentHtml: html,
      contentText: post.content,
      topic: post.topic,
      tags: post.tags,
      date: post.date,
      publishedAt: null,
      readMinutes: computeReadMinutes(post.content),
    };
  });
}

interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentHtml: string;
  contentText: string;
  topic: string;
  tags: string[];
  publishedAt: Date | null;
  readMinutes: number;
  coverMedia: { url: string } | null;
  coverAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
}

function toView(row: PostRow): BlogPostView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || extractText(row.contentHtml).slice(0, 200),
    // Re-sanitized: never trust a stored value, even one this loader wrote itself.
    contentHtml: sanitizeRich(row.contentHtml),
    contentText: row.contentText,
    topic: row.topic,
    tags: row.tags,
    date: row.publishedAt ? formatDate(row.publishedAt) : "",
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    readMinutes: row.readMinutes,
    coverUrl: row.coverMedia?.url,
    coverAlt: row.coverAlt || undefined,
    seoTitle: row.seoTitle || undefined,
    seoDescription: row.seoDescription || undefined,
    canonicalUrl: row.canonicalUrl || undefined,
  };
}

// Status is the only visibility gate, exported so a test can assert it never
// grows a publishAt comparison. A SCHEDULED post stays hidden until
// lib/cron/jobs.ts's blogPublishJob (or a manual publish) actually promotes
// it to PUBLISHED (docs/plan/admin-cms-adr.md, Step 12).
export const PUBLISHED_WHERE = { status: "PUBLISHED" } as const;

type PostSelectDb = Pick<typeof db.post, "findMany">;

export async function readPublishedPosts(client: PostSelectDb = db.post): Promise<PostRow[]> {
  return client.findMany({
    where: PUBLISHED_WHERE,
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      contentHtml: true,
      contentText: true,
      topic: true,
      tags: true,
      publishedAt: true,
      readMinutes: true,
      coverMedia: { select: { url: true } },
      coverAlt: true,
      seoTitle: true,
      seoDescription: true,
      canonicalUrl: true,
    },
  });
}

const cachedReadPosts = cached(readPublishedPosts, ["blog", "list"], {
  tags: [TAGS.blogList],
  revalidate: 300,
});

/**
 * Published posts, newest first. Falls back to `UpdatesContent.posts` only
 * when the Post table is empty (not configured, a build-time failure, or
 * genuinely zero rows) — same fallback rule as the works collections.
 */
export async function getPosts(defaults: BlogPostView[] = defaultPosts()): Promise<BlogPostView[]> {
  const rows = await loadOrNull(cachedReadPosts, {
    onError: (error) => log.warn("blog posts read failed during build, using defaults", { error: String(error) }),
  });
  if (!rows || rows.length === 0) return defaults;
  return rows.map(toView);
}

/** One published post by slug, or null. Delegates to getPosts() so the empty-table fallback applies here too. */
export async function getPostBySlug(slug: string, defaults: BlogPostView[] = defaultPosts()): Promise<BlogPostView | null> {
  const posts = await getPosts(defaults);
  return posts.find((post) => post.slug === slug) ?? null;
}

export interface TaxonomyEntry {
  name: string;
  count: number;
}

/** Topics and tags computed from the posts actually shown, so a filter never advertises something absent. */
export function taxonomyOf(posts: BlogPostView[]): { topics: TaxonomyEntry[]; tags: TaxonomyEntry[] } {
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
