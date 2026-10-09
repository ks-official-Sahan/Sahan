import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import FinalCta from "@/components/home/FinalCta";
import AboutPageView from "@/components/pages/AboutPageView";
import ContactPageView from "@/components/pages/ContactPageView";
import HomePageView from "@/components/pages/HomePageView";
import UpdatesPageView from "@/components/pages/UpdatesPageView";
import WorksPageView from "@/components/pages/WorksPageView";
import { requirePermission } from "@/lib/auth/dal";
import { isCmsPage } from "@/lib/cms/registry";
import { loadPreviewContent } from "@/lib/cms/service";
import { getProjects, getExperience, getServices, getSkills } from "@/lib/collections";
import { getRecentPosts } from "@/lib/blog/queries";
import { getGitHubStats } from "@/lib/github";
import { Projects } from "@/contents/projects";
import { Experience } from "@/contents/experience";

// What visitors would see if every saved draft were published: draft over
// published over the code defaults. It reuses the same page views as the public
// routes, so the preview cannot drift from the site. It lives under (site) to get
// the site's chrome, styles and CSP; the permission check keeps it private and
// the noindex keeps it out of search results. It shows drafts, so it is never cached.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

export default async function PreviewPage({ params }: { params: Promise<{ page: string }> }) {
  await requirePermission("editPages");
  const { page } = await params;
  if (!isCmsPage(page)) notFound();

  const home = await loadPreviewContent("home");
  const [projects, experience, serviceGroups, skillGroups] = await Promise.all([
    getProjects(Projects),
    getExperience(Experience),
    getServices(),
    getSkills(),
  ]);
  const finalCta = <FinalCta content={home.finalCta} channels={home.channels} />;

  let view: React.ReactNode;
  switch (page) {
    case "home":
      view = <HomePageView content={home} projects={projects} experience={experience} serviceGroups={serviceGroups} skillGroups={skillGroups} />;
      break;
    case "about": {
      const [about, githubStats] = await Promise.all([loadPreviewContent("about"), getGitHubStats()]);
      view = <AboutPageView content={about} home={home} githubStats={githubStats} projects={projects} experience={experience} serviceGroups={serviceGroups} skillGroups={skillGroups} />;
      break;
    }
    case "works":
      view = <WorksPageView content={await loadPreviewContent("works")} projects={projects} finalCta={finalCta} skillGroups={skillGroups} />;
      break;
    case "updates": {
      const posts = (await getRecentPosts(50)).map((post) => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        date: post.date,
        excerpt: post.excerpt,
        topic: post.topic,
        tags: post.tags,
      }));
      view = <UpdatesPageView content={await loadPreviewContent("updates")} posts={posts} nextCursor={null} finalCta={finalCta} />;
      break;
    }
    case "contact":
      view = <ContactPageView content={await loadPreviewContent("contact")} home={home} />;
      break;
    default:
      // A CMS page added to the registry without a case here 404s instead of rendering blank.
      notFound();
  }

  return (
    <>
      <div
        role="note"
        className="sticky top-0 z-[60] flex flex-wrap items-center justify-between gap-2 bg-amber-400 px-4 py-2 text-sm text-black"
      >
        <span>Preview with your saved drafts. Visitors do not see this until it is published.</span>
        <Link href={`/admin/content/${page}`} className="font-medium underline underline-offset-4">
          Back to the editor
        </Link>
      </div>
      {view}
    </>
  );
}
