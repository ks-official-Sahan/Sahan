// The invalidation matrix of docs/plan/admin-cms-adr.md section 5.4 as pure
// functions. Server Actions and Route Handlers build a plan here and pass it
// to invalidate() (lib/cache/invalidate.ts).

import { PAGE_SLUGS, TAGS, staticTags, type CollectionName, type PageSlug } from "./tags";

export type PathEntry = string | { path: string; type: "page" | "layout" };

export interface InvalidationPlan {
  tags: string[];
  paths: PathEntry[];
}

/** Public routes each page slug feeds. `site` feeds all of them. */
export const PAGE_PATHS: Record<PageSlug, string[]> = {
  home: ["/"],
  about: ["/about"],
  works: ["/works"],
  updates: ["/updates"],
  contact: ["/contact"],
  site: ["/", "/about", "/works", "/updates", "/contact"],
};

const unique = <T>(items: T[]): T[] => [...new Set(items)];

/** Publish or restore a section of a page. `consumers` comes from the registry. */
export function forContentPublish(
  page: PageSlug,
  options: { consumers?: readonly string[]; section?: string } = {}
): InvalidationPlan {
  const tags = [TAGS.page(page), TAGS.chatbotKnowledge];
  if (page === "site") tags.push(TAGS.siteConfig);

  const paths: PathEntry[] = [...(options.consumers ?? PAGE_PATHS[page])];
  if (page === "site" && options.section === "seo") paths.push("/sitemap.xml");

  return { tags: unique(tags), paths: unique(paths) };
}

/** Create, update, delete, reorder or publish-toggle in a works collection. */
export function forCollection(name: CollectionName): InvalidationPlan {
  const paths: string[] = ["/", "/about", "/works"];
  // Experience affects about and home team/timeline
  if (name === "experience") paths.push("/about");
  // Projects affect home featured works and works page
  if (name === "projects") {
    // Already included: "/", "/about", "/works"
  }
  return {
    tags: [TAGS.collection(name), TAGS.chatbotKnowledge],
    paths: [...new Set(paths)],
  };
}

/** Publish, unpublish, edit or delete one post. */
export function forPost(slug: string): InvalidationPlan {
  return {
    tags: [TAGS.blogList, TAGS.blogPost(slug), TAGS.blogTaxonomy, TAGS.chatbotKnowledge],
    paths: ["/updates", `/updates/${slug}`, "/sitemap.xml", "/rss.xml"],
  };
}

/** Bulk post changes and the scheduled-publish tick: the list, not one post. */
export function forPostList(): InvalidationPlan {
  return {
    tags: [TAGS.blogList, TAGS.blogTaxonomy, TAGS.chatbotKnowledge],
    paths: ["/updates", "/sitemap.xml", "/rss.xml"],
  };
}

/** Save operational settings that the public layout reads. */
export function forSettings(): InvalidationPlan {
  return {
    tags: [TAGS.settingsPublic],
    paths: [{ path: "/", type: "layout" }],
  };
}

/** Chatbot training entries changed. */
export function forTraining(): InvalidationPlan {
  return { tags: [TAGS.chatbotKnowledge], paths: [] };
}

/** The "clear cache" button: every slug-independent tag and the whole public layout. */
export function forCacheClear(): InvalidationPlan {
  return {
    tags: staticTags(),
    paths: [{ path: "/", type: "layout" }],
  };
}

export { PAGE_SLUGS };
