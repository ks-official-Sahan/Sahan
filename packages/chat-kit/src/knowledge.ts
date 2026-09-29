import type { ChatSite } from "./types";

// The chatbot's reference text, assembled from independent sources (profile,
// CMS pages, collections, posts, training Q&A). The host app decides what the
// sources are and caches the result; this module only runs them together and
// keeps one failing source from emptying the whole knowledge base.

export interface KnowledgeSource {
  /** Used in error reports only. */
  name: string;
  /** Returns a Markdown chunk, or "" when there is nothing to add. */
  load(): Promise<string> | string;
}

export interface BuildKnowledgeOptions {
  onError?: (source: string, error: unknown) => void;
}

/** Runs every source in parallel and joins their chunks in the given order. */
export async function buildKnowledge(sources: readonly KnowledgeSource[], options: BuildKnowledgeOptions = {}): Promise<string> {
  const chunks = await Promise.all(
    sources.map(async (source) => {
      try {
        return await source.load();
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
    `- **GitHub:** ${site.gitHubUrl}\n`,
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
