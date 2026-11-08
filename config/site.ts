const PHONE = "+94768701148";

export const Site = {
  siteName: "Sahan",
  fooTxt: "Sahan.",
  gitHubUser: "@ks-official-sahan",
  tagline: "✨ Never Give Up Until I Make a Difference!",
  gitHubUrl: "https://github.com/ks-official-sahan",
  author: "Sahan",
  authorFullName: "Sahan Sachintha",
  authorPortfolio: "#",
  email: "ks.official.sahan@gmail.com",
  phone: PHONE,
  phoneDisplay: "+94 76-870-1148",
  location: "Sri Lanka - Available for Remote Work",
  org: "Datalake Creative",
  orgUrl: "https://datalakecreative.com",
  myRole: "Full-Stack Software Engineer",
  companyRole: "Software Engineer at Datalake Creative Ltd",
  // Both links are built from the phone number. Swap `telegramUrl` for a
  // https://t.me/<username> link if a public Telegram username exists.
  whatsAppUrl: `https://wa.me/${PHONE.replace(/\D/g, "")}?text=${encodeURIComponent(
    "Hi Sahan, I found your portfolio and would like to talk about a project."
  )}`,
  telegramUrl: `https://t.me/${PHONE}`,
};

export const SiteMetadata = {
  title: "Sahan Sachintha",
  description:
    "Sahan Sachintha is a full-stack software engineer at Datalake Creative, building web and mobile products remotely from Sri Lanka.",
  author: "Sahan Sachintha",
  siteUrl: "https://sahansachintha.com",
  githubUsername: "ks-official-sahan",
  twitterUsername: "@SahanSubasingha",
  ogSiteName: "Sahan Sachintha",
  legalName: "Sahan Sachintha",
};

export const PageMetadata = {
  about: {
    title: "Full-stack engineer in Sri Lanka",
    description:
      "Sahan Sachintha is a full-stack software engineer at Datalake Creative. Read his background, skills, and the products he ships remotely from Sri Lanka.",
  },
  works: {
    title: "Web and mobile projects",
    description:
      "Web apps, mobile products, and client systems shipped by Sahan Sachintha, a full-stack software engineer at Datalake Creative. Each project has its own page.",
  },
  updates: {
    title: "Engineering notes and releases",
    description:
      "Notes from Sahan Sachintha on shipping software: releases, data fetching, security, and the work behind the products at Datalake Creative.",
  },
  contact: {
    title: "Start a software project",
    description:
      "Contact Sahan Sachintha about a web or mobile project. He replies by email or WhatsApp. He is a full-stack engineer at Datalake Creative.",
  },
};
