import "server-only";

import { getSetting, updateSetting } from "@/lib/settings/service";
import { getProjects, getExperience } from "@/lib/collections";
import { getIndexablePosts } from "@/lib/blog/queries";
import { getPageContent } from "@/lib/cms/loaders";
import { Projects } from "@/contents/projects";
import { Experience } from "@/contents/experience";
import { MySkills } from "@/contents/skills";
import { Site, SiteMetadata } from "@/config/site";
import type { AuthUser } from "@/lib/auth/dal";

import { absoluteSiteUrl } from "./indexnow";

// llms.txt: a short, curated index in the llmstxt.org shape (H1, one-line
// blockquote, `- [title](url): note` sections) that gives AI crawlers and
// assistant agents a structured summary of the site — same purpose as a
// sitemap, but written for language models instead of URL crawlers.
//
// Persisted in the `seo.llmsTxt` setting (not the filesystem — Vercel's
// runtime filesystem is read-only outside /tmp, so writing to
// public/llms.txt from a Server Action would throw on every deploy).
// /llms.txt falls back to generating on the fly when nobody has regenerated
// it yet, so it is never a 404 and never permanently stale by omission.

function link(path: string, title: string, note?: string): string {
  return `- [${title}](${absoluteSiteUrl(path)})${note ? `: ${note}` : ""}`;
}

/** Same list format as link(), for an already-absolute (external) URL. */
function externalLink(url: string, title: string, note?: string): string {
  return `- [${title}](${url})${note ? `: ${note}` : ""}`;
}

// A curated, representative slice of contents/skills.ts's own skill list
// (the data the /about skills grid renders from), not a hand-written list —
// filtered against the real data so a name here always exists on the site.
// Picked to span frontend/backend/mobile/data/cloud instead of the first N
// in file order, which would be frontend-only (SC1 alone has 16 entries).
const KEY_SKILL_NAMES = [
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Python",
  "Java",
  "React Native",
  "Flutter",
  "PostgreSQL",
  "MongoDB",
  "Docker",
  "AWS",
  "GraphQL",
  "Prisma",
];

/** Builds fresh llms.txt content from the same data sources the site itself renders. */
export async function generateLlmsTxt(): Promise<string> {
  const [projects, experience, posts, about] = await Promise.all([
    getProjects(Projects),
    getExperience(Experience),
    getIndexablePosts(),
    // The About page's "Who I Am" bio card — CMS content, editable from the
    // admin, and the same text the /about page itself renders
    // (lib/cms/pages/about.ts's `bento` section). Publishing About's hero or
    // bento section revalidates this file too (lib/cache/plan.ts).
    getPageContent("about"),
  ]);

  const featured = projects.filter((project) => project.featured);
  const latestRole = experience.find((entry) => entry.current) ?? experience[0];
  const allSkillNames = new Set(
    MySkills.tabs.categories.flatMap((group) => group.skills.map((skill) => skill.name))
  );
  const keySkills = KEY_SKILL_NAMES.filter((name) => allSkillNames.has(name));

  const lines: string[] = [
    `# ${SiteMetadata.title}`,
    "",
    `> ${SiteMetadata.description} Based in ${Site.location}.`,
    "",
    "## Core pages",
    link("", "Home", "overview, featured work, and current role"),
    link("/about", "About", "background, skills, and experience timeline"),
    link("/works", "Works", `${projects.length} projects across product, freelance, and contract work`),
    link("/updates", "Updates", "blog posts and progress notes"),
    link("/contact", "Contact", "get in touch"),
    "",
    "## Author",
    `${SiteMetadata.author} — ${Site.myRole} at ${Site.org}, based in ${Site.location}.`,
    about.bento.cardDescription,
    ...(keySkills.length > 0 ? [`Key skills: ${keySkills.join(", ")}.`] : []),
    externalLink(`mailto:${Site.email}`, "Email", Site.email),
    externalLink(Site.gitHubUrl, "GitHub", Site.gitHubUser),
    externalLink(Site.orgUrl, Site.org, "current organization"),
    "",
  ];

  if (latestRole) {
    lines.push(
      "## Current role",
      `${latestRole.role} at ${latestRole.company}${latestRole.location ? `, ${latestRole.location}` : ""} (${latestRole.period}).`,
      ""
    );
  }

  if (featured.length > 0) {
    lines.push("## Featured projects");
    for (const project of featured) {
      lines.push(link(`/works#${project.slug}`, project.title, project.tagline));
    }
    lines.push("");
  }

  if (posts.length > 0) {
    lines.push("## Recent updates");
    for (const post of posts.slice(0, 10)) {
      lines.push(link(`/updates/${post.slug}`, post.title, post.excerpt));
    }
    lines.push("");
  }

  lines.push(
    "## Contact",
    `${Site.email}${Site.phoneDisplay ? ` · ${Site.phoneDisplay}` : ""}`,
    ""
  );

  return lines.join("\n");
}

/** Serves the persisted content, generating on the fly if never regenerated. */
export async function getLlmsTxtContent(): Promise<string> {
  const stored = await getSetting("seo.llmsTxt");
  if (stored.content) return stored.content;
  return generateLlmsTxt();
}

/** Regenerates and persists llms.txt. Caller must already hold `manageSettings`. */
export async function regenerateLlmsTxt(actor: Pick<AuthUser, "id" | "email">): Promise<string> {
  const content = await generateLlmsTxt();
  await updateSetting("seo.llmsTxt", { content, generatedAt: new Date().toISOString() }, actor);
  return content;
}
