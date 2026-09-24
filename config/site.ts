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
    description:
      "Sahan Sachintha is a full-stack software engineer who builds web and mobile products end to end. Read about his background, technical skills, and experience.",
  },
  works: {
    title: "Works",
    description:
      "App-store products, client websites, and the business systems behind them, including POS and inventory tools. Open any project for links and its story.",
  },
  updates: {
    title: "Updates",
    description:
      "Release notes, personal notes, bug fixes, and new features from ongoing projects — a running log of what shipped and what changed, posted as progress happens.",
  },
  contact: {
    title: "Contact",
    description:
      "Get in touch about a project, an idea, or just to say hi. Reach out by email or WhatsApp — replies come from Sahan directly, never an automated bot.",
  },
};
