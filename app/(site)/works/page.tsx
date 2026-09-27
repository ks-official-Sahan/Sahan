import FinalCta from "@/components/home/FinalCta";
import WorksPageView from "@/components/pages/WorksPageView";
import { getPageContent } from "@/lib/cms/loaders";
import type { PageContent } from "@/lib/cms/registry";
import React from "react";

const Works = async () => {
  const [works, home] = await Promise.all([
    getPageContent("works"),
    getPageContent("home"),
  ]);

  const finalCta = (
    <FinalCta content={home.finalCta} channels={home.channels} />
  );

  return <WorksPageView content={works} finalCta={finalCta} />;
};

export default Works;
