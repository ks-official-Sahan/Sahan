import type { ChatSite } from "./types";

// The chatbot's reference text, assembled from independent sources (profile,
// CMS pages, collections, posts, training Q&A). The host app decides what the
// sources are and caches the result; this module only runs them together and
// keeps one failing source from emptying the whole knowledge base.

/** What the visitor is asking, so a source can return only what is relevant. */
export interface KnowledgeQuery {
  /** The visitor's latest message. */
  message: string;
  /** Earlier visitor turns, oldest first (follow-ups like "cheaper ones?"). */
  history?: readonly string[];
  /** The page the visitor is on, when the widget sends it. */
  page?: { path: string; title?: string };
}

export interface KnowledgeSource {
  /** Used in error reports only. */
  name: string;
  /** Returns a Markdown chunk, or "" when there is nothing to add. */
  load(query?: KnowledgeQuery): Promise<string> | string;
}

export interface BuildKnowledgeOptions {
  onError?: (source: string, error: unknown) => void;
}

/** Runs every source in parallel and joins their chunks in the given order. */
export async function buildKnowledge(
  sources: readonly KnowledgeSource[],
  options: BuildKnowledgeOptions = {},
  query?: KnowledgeQuery
): Promise<string> {
  const chunks = await Promise.all(
    sources.map(async (source) => {
      try {
        return await source.load(query);
      } catch (error) {
        options.onError?.(source.name, error);
        return "";
      }
    })
  );
  return chunks.join("");
}

/** The owner's identity, so the assistant always knows who it speaks for. */
export function profileSection(site: ChatSite): string {
  return [
    "### Owner Profile\n",
    `- **Full Name:** ${site.authorFullName} (${site.author})\n`,
    `- **Role:** ${site.role}\n`,
    `- **Current Position:** ${site.company}\n`,
    `- **Location:** ${site.location}\n`,
    `- **Tagline:** ${site.tagline}\n`,
    `- **Email:** ${site.email}\n`,
    `- **WhatsApp:** ${site.phoneDisplay}\n`,
    site.gitHubUrl ? `- **GitHub:** ${site.gitHubUrl}\n` : "",
    `- **Bio / Overview:** ${site.description}\n\n`,
  ].join("");
}

/** Admin-written question and answer pairs, highest priority first. */
export function trainingSection(entries: readonly { question: string; answer: string }[]): string {
  if (entries.length === 0) return "";
  return "\n### Training Data\n" + entries.map((entry) => `**Q:** ${entry.question}\n**A:** ${entry.answer}\n\n`).join("");
}

/** Hosts the knowledge links to: the only outside hosts a reply may link to. */
export function knowledgeHosts(knowledge: string): string[] {
  return [...knowledge.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((match) => match[1].toLowerCase());
}

const STOP_WORDS = new Set("a an and are at be by can do for from have how i in is it me my of on or show tell that the this to want what where which with you your".split(" "));

/** Lowercase search terms of a query: words of 2+ letters or digits, stop words removed. */
export function queryTerms(query: KnowledgeQuery | string): string[] {
  const text = typeof query === "string" ? query : [query.message, ...(query.history ?? []).slice(-2), query.page?.title ?? ""].join(" ");
  const words = text.toLowerCase().normalize("NFKC").match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  return [...new Set(words.filter((word) => !STOP_WORDS.has(word)))];
}

/**
 * The `limit` items that best match the query, best first, by how many query
 * terms appear in each item's text. Ties keep the input order, so pass items
 * already sorted by your own default (featured, newest). With no terms (an
 * empty or stop-word-only question) the first `limit` items are returned.
 * O(items x terms).
 */
export function rankByQuery<T>(items: readonly T[], query: KnowledgeQuery | string, text: (item: T) => string, limit: number): T[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return items.slice(0, limit);
  return items
    .map((item, index) => {
      const haystack = text(item).toLowerCase();
      return { item, index, score: terms.reduce((sum, term) => sum + Number(haystack.includes(term)), 0) };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}
