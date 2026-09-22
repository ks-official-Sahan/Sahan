import FinalCta from "@/components/home/FinalCta";
import UpdatesPageView from "@/components/pages/UpdatesPageView";
import { getPageContent } from "@/lib/cms/loaders";
import React from "react";

const Updates = async () => {
  const [updates, home] = await Promise.all([
    getPageContent("updates"),
    getPageContent("home"),
  ]);

  const finalCta = (
    <FinalCta content={home.finalCta} channels={home.channels} />
  );

  return <UpdatesPageView content={updates} finalCta={finalCta} />;
};

export default Updates;
