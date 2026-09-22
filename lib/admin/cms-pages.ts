import type { CmsPage } from "@/lib/cms/registry";

// How the CMS pages are named and reached in the admin. Kept apart from the
// registry, which holds content rules and must not know about admin screens.

export const CMS_PAGE_INFO: Record<CmsPage, { label: string; path: string; blurb: string }> = {
  home: { label: "Home", path: "/", blurb: "Hero, proof, services, process, FAQ and the closing call to action." },
  about: { label: "About", path: "/about", blurb: "Intro, bento cards, services, skills and experience wording." },
  works: { label: "Works", path: "/works", blurb: "Hero, tabs, results and the behind-the-scenes block." },
  updates: { label: "Updates", path: "/updates", blurb: "Hero and filter titles for the updates list." },
  contact: { label: "Contact", path: "/contact", blurb: "Hero, form wording, tips and social links." },
};
