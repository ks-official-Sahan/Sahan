import type { BlogSiteProfile } from "@sahan-sac/blog-kit/prompts";

/** How AI-written posts describe this site, and the only site paths they may link to. */
export const blogSite: BlogSiteProfile = {
  description: "a software engineer's personal portfolio site",
  internalLinks: ["/", "/works", "/about", "/contact", "/updates"],
  callToAction: ["/contact", "/works"],
};
