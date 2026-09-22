import "server-only";

import { cached } from "@/lib/cache/cached";
import { loadOrNull } from "@/lib/cache/fallback";
import { TAGS } from "@/lib/cache/tags";
import { db } from "@/lib/db/prisma";
import { log } from "@/lib/log";
import { getPageContent } from "@/lib/cms/loaders";

// Builds the knowledge base for the chatbot from published CMS content and
// active training entries. Cached under the `chatbot:knowledge` tag and
// invalidated whenever content, collections or training entries change.

async function buildKnowledge(): Promise<string> {
  const parts: string[] = [];

  try {
    // Get published CMS content for all pages with proper typing
    const home = await getPageContent("home");
    const about = await getPageContent("about");
    const works = await getPageContent("works");
    const contact = await getPageContent("contact");

    parts.push("### Site Overview\n");

    // Home hero content (typed fields)
    if (home.hero?.title) {
      parts.push(`**Site:** ${home.hero.title}\n`);
      if (home.hero.subtitle) parts.push(`${home.hero.subtitle}\n`);
    }

    // About hero content (About has titleLine1/titleLine2)
    if (about.hero?.titleLine1) {
      parts.push(`\n**About:** ${about.hero.titleLine1}\n`);
    }

    // Works hero content
    if (works.hero?.title) {
      parts.push(`\n**Works:** ${works.hero.title}\n`);
    }

    // Skills and experience are collections from database, not directly in CMS sections
    // They are loaded separately and rendered by the public pages
    // Knowledge builder focuses on the CMS-editable content above

    // Contact information
    if (contact.socials?.items && Array.isArray(contact.socials.items)) {
      parts.push("\n### Contact Channels\n");
      for (const social of contact.socials.items.slice(0, 5)) {
        if (social.label) {
          parts.push(`- **${social.label}**\n`);
        }
      }
    }
  } catch (error) {
    log.error("Error building knowledge from CMS content", { error: String(error) });
  }

  // Get active training entries
  try {
    const entries = await db.chatTrainingEntry.findMany({
      where: { isActive: true },
      orderBy: { priority: "desc" },
      take: 50,
    });

    if (entries.length > 0) {
      parts.push("\n### Training Data\n");
      for (const entry of entries) {
        parts.push(`**Q:** ${entry.question}\n**A:** ${entry.answer}\n\n`);
      }
    }
  } catch (error) {
    log.error("Error building knowledge from training entries", { error: String(error) });
  }

  return parts.join("");
}

// Load knowledge from cache or null if database is not configured
export async function getKnowledge(): Promise<string | null> {
  return loadOrNull(
    cached(buildKnowledge, ["chatbot", "knowledge"], {
      tags: [TAGS.chatbotKnowledge],
      revalidate: 3600,
    }),
    {
      onError: (error) =>
        log.warn("chatbot knowledge read failed during build", { error: String(error) }),
    }
  );
}
