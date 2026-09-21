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
    "Full-Stack Software Engineer building cross-platform products, dashboards, and web experiences.",
  author: "Sahan Sachintha",
  siteUrl: "https://sahansachintha.com",
  githubUsername: "ks-official-sahan",
  twitterUsername: "@SahanSubasingha",
  ogSiteName: "Sahan Sachintha",
  legalName: "Sahan Sachintha",
};

export const PageMetadata = {
  about: {
    title: "About",
    description: "Learn more about my journey and professional background.",
  },
  works: {
    title: "Works",
    description: "Explore my projects and professional achievements.",
  },
  updates: {
    title: "Updates",
    description: "Read my daily updates and progress notes.",
  },
  contact: {
    title: "Contact",
    description: "Let's connect and discuss your next big idea!",
  },
};
