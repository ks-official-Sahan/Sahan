import FinalCta from "@/components/home/FinalCta";
import WorksPageView from "@/components/pages/WorksPageView";
import { SiteMetadata } from "@/config/site";
import { getPageContent } from "@/lib/cms/loaders";
import { getProjects, getSkills } from "@/lib/collections";
import { isIndexableProject } from "@/lib/seo/copy";
import { jsonLdHtml } from "@/lib/seo/json-ld";
import { siteUrl } from "@/lib/site-url";
import React from "react";
import { Projects } from "@/contents/projects";

const Works = async () => {
  const [works, home, projects, skillGroups, origin] = await Promise.all([
    getPageContent("works"),
    getPageContent("home"),
    getProjects(Projects),
    getSkills(),
    siteUrl(),
  ]);
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Projects by ${SiteMetadata.legalName}`,
    itemListElement: projects.filter((project) => isIndexableProject(project.status)).map((project, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: project.title,
      url: `${origin}/works/${project.slug}`,
    })),
  };

  const finalCta = (
    <FinalCta key="final-cta" content={home.finalCta} channels={home.channels} />
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(itemList) }} />
      <WorksPageView content={works} projects={projects} finalCta={finalCta} skillGroups={skillGroups} />
    </>
  );
};

export default Works;
