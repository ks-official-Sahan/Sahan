import FinalCta from "@/components/home/FinalCta";
import WorksPageView from "@/components/pages/WorksPageView";
import { getPageContent } from "@/lib/cms/loaders";
import { getProjects, getSkills } from "@/lib/collections";
import type { PageContent } from "@/lib/cms/registry";
import React from "react";
import { Projects } from "@/contents/projects";

const Works = async () => {
  const [works, home, projects, skillGroups] = await Promise.all([
    getPageContent("works"),
    getPageContent("home"),
    getProjects(Projects),
    getSkills(),
  ]);

  const finalCta = (
    <FinalCta content={home.finalCta} channels={home.channels} />
  );

  return <WorksPageView content={works} projects={projects} finalCta={finalCta} skillGroups={skillGroups} />;
};

export default Works;
