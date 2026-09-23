import "server-only";

import { cached } from "@/lib/cache/cached";
import { loadOrNull } from "@/lib/cache/fallback";
import { TAGS } from "@/lib/cache/tags";
import { db } from "@/lib/db/prisma";
import { log } from "@/lib/log";
import { getPosts } from "@/lib/blog/queries";
import { getPageContent } from "@/lib/cms/loaders";
import { getExperience, getProjects } from "@/lib/collections";
import { Experience } from "@/contents/experience";
import { Projects } from "@/contents/projects";

// Builds the knowledge base for the chatbot from published CMS content and
// active training entries. Cached under the `chatbot:knowledge` tag and
// invalidated whenever content, collections or training entries change.

async function buildKnowledge(): Promise<string> {
  const parts: string[] = [];

  try {
    const [home, about, works, contact] = await Promise.all([
      getPageContent("home"),
      getPageContent("about"),
      getPageContent("works"),
      getPageContent("contact"),
    ]);

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

    // Collections and posts: the questions visitors actually ask ("what have you
    // built?", "where have you worked?"). Each change to them already drops
    // this cache through the chatbot:knowledge tag (lib/cache/plan.ts).
    const [projects, experience, posts] = await Promise.all([
      getProjects(Projects),
      getExperience(Experience),
      getPosts(),
    ]);

    if (projects.length > 0) {
      parts.push("\n### Projects\n");
      for (const project of projects.slice(0, 25)) {
        const meta = [project.role, project.organization, project.status].filter(Boolean).join(", ");
        const tech = project.tech?.length ? ` Tech: ${project.tech.slice(0, 10).join(", ")}.` : "";
        const link = project.links?.[0]?.url ? ` Link: ${project.links[0].url}` : "";
        parts.push(`- **${project.title}** (${meta}): ${project.tagline}.${tech}${link}\n`);
      }
    }

    if (experience.length > 0) {
      parts.push("\n### Experience\n");
      for (const entry of experience.slice(0, 15)) {
        const highlights = entry.highlights.slice(0, 3).join(" ");
        parts.push(`- **${entry.role}** at ${entry.company} (${entry.period}${entry.current ? ", current" : ""}). ${highlights}\n`);
      }
    }

    if (posts.length > 0) {
      parts.push("\n### Recent writing (on /updates)\n");
      for (const post of posts.slice(0, 10)) parts.push(`- ${post.title} (/updates/${post.slug})\n`);
    }

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
    // Bump the version when the knowledge format changes, so stale entries are not served.
    cached(buildKnowledge, ["chatbot", "knowledge", "v2"], {
      tags: [TAGS.chatbotKnowledge],
      revalidate: 3600,
    }),
    {
      onError: (error) =>
        log.warn("chatbot knowledge read failed during build", { error: String(error) }),
    }
  );
}
