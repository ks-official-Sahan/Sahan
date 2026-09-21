import { Project } from "@/types/project";

// Every project below is real work, grouped by where it was built. Links only
// point at things that were checked to be reachable; anything unpublished,
// upcoming or offline says so through `status` instead of a dead link. Images
// live in /public/works so they keep working if the source site goes away.

const DATALAKE = "Datalake Creative Ltd";
const DATALAKE_URL = "https://datalakecreative.com";

const datalakeProducts: Project[] = [
  {
    slug: "wizzie-words",
    title: "Wizzie Words",
    tagline: "Dictionary app that makes learning a daily habit",
    description:
      "A dictionary app people actually open every day: instant lookups, a word of the day, and games that turn new vocabulary into a streak. Live on Google Play and the App Store, with a web presence and an admin panel behind it.",
    role: "Software Engineer",
    organization: DATALAKE,
    organizationUrl: DATALAKE_URL,
    category: "product",
    status: "live",
    platforms: ["android", "ios", "web", "web-admin"],
    links: [
      { kind: "website", url: "https://wizziewords.com" },
      {
        kind: "playstore",
        url: "https://play.google.com/store/apps/details?id=com.wowwords.app&hl=en&gl=US",
      },
      {
        kind: "appstore",
        url: "https://apps.apple.com/gb/app/wizzie-words/id6450110439",
      },
    ],
    image: {
      src: "/works/wizzie-words.webp",
      alt: "Wizzie Words app: home screen with word of the day and a word definition sheet",
      fit: "contain",
      background: "#ffffff",
    },
    year: "2025",
    featured: true,
  },
  {
    slug: "reaktu",
    title: "Reaktu",
    tagline: "Social platform built around topics, not noise",
    description:
      "A social platform where your feed follows your topics: react, unlock new topic tiers and join conversations that match what you care about. Shipped as Android, iOS and web apps with an admin panel.",
    role: "Software Engineer",
    organization: DATALAKE,
    organizationUrl: DATALAKE_URL,
    category: "product",
    status: "live",
    platforms: ["android", "ios", "web", "web-admin"],
    links: [
      { kind: "website", url: "https://www.reaktu.com/" },
      { kind: "webapp", url: "https://app.reaktu.com" },
      {
        kind: "playstore",
        url: "https://play.google.com/store/apps/details?id=com.reaktu.app&hl=en_GB",
      },
      {
        kind: "appstore",
        url: "https://apps.apple.com/gb/app/reaktu/id6753275373",
      },
    ],
    image: {
      src: "/works/reaktu.webp",
      alt: "Reaktu website home page: Your Feed. Your Topics. Your Progression.",
      position: "50% 30%",
    },
    year: "2025",
    featured: true,
  },
  {
    slug: "meto",
    title: "Meto App",
    tagline: "AI money companion, launching soon",
    description:
      "A personal finance app with an AI assistant that explains your money score and nudges savings towards your goals. Not in the stores yet; the business site is live while the apps get their final polish.",
    role: "Software Engineer",
    organization: DATALAKE,
    organizationUrl: DATALAKE_URL,
    category: "product",
    status: "upcoming",
    platforms: ["android", "ios", "web", "web-admin"],
    links: [{ kind: "website", url: "https://meto.app/" }],
    image: {
      src: "/works/meto.webp",
      alt: "Meto app: Ask Meto AI chat and savings summary on a phone",
      fit: "contain",
      background: "#ffffff",
    },
    year: "2025",
  },
  {
    slug: "channel-direct",
    title: "Channel Direct",
    tagline: "A direct line between brands and their customers",
    description:
      "An app that lets businesses stay connected with their customers on simple, direct terms. Upcoming: the landing site is live, the apps are on their way to the stores.",
    role: "Software Engineer",
    organization: DATALAKE,
    organizationUrl: DATALAKE_URL,
    category: "product",
    status: "upcoming",
    platforms: ["android", "ios", "web", "web-admin"],
    links: [{ kind: "website", url: "https://channeldirect.io/" }],
    image: {
      src: "/works/channel-direct.webp",
      alt: "Channel Direct app welcome screen: A better way to stay connected",
      fit: "contain",
      background: "#ffffff",
    },
    year: "2025",
  },
  {
    slug: "hatchy",
    title: "Hatchy",
    tagline: "Multi-tenant project management for teams",
    description:
      "A cross-platform project management tool with multi-tenant workspaces: task boards, support and messaging, all in one app for Android, iOS and web. Built and tested; the apps are not published yet.",
    role: "Software Engineer",
    organization: DATALAKE,
    organizationUrl: DATALAKE_URL,
    category: "product",
    status: "unpublished",
    platforms: ["android", "ios", "web"],
    image: {
      src: "/works/hatchy.webp",
      alt: "Hatchy mobile app: dashboard and task board in dark mode",
      position: "50% 35%",
    },
    year: "2025",
  },
];

const evisionProjects: Project[] = [
  {
    slug: "weeraman-finance",
    title: "Financial Management System",
    tagline: "Finance platform demo for Weeraman Associates",
    description:
      "A clickable financial management demo designed for Evision IT: cash and receivables at a glance, one-tap invoices and payments, an approvals inbox and a full audit log.",
    role: "Software Engineer (design and frontend)",
    organization: "Evision IT PVT Ltd",
    organizationUrl: "https://evision-it.com",
    category: "contract",
    status: "demo",
    platforms: ["web"],
    links: [{ kind: "demo", url: "https://weeraman-associate.vercel.app/" }],
    image: {
      src: "/works/weeraman-finance.webp",
      alt: "Weeraman Associates finance dashboard with cash, receivables and quick actions",
      position: "50% 0%",
    },
    year: "2025",
  },
];

// codyzea.com and codyzea.co.nz are down, so the team link is the company's
// Facebook page, and the two client sites that went offline with it say so.
const CODYZEA = "CodyZea PVT Ltd";
const CODYZEA_URL =
  "https://web.facebook.com/people/Cody-Zea-Software-Solutions/61569599424974/";

const codyzeaProjects: Project[] = [
  {
    slug: "ceynap",
    title: "Ceynap",
    tagline: "Business website for a New Zealand brand",
    description:
      "A business website for a New Zealand company, delivered as a team project that I led at CodyZea from planning through launch.",
    role: "Team Lead (contract)",
    organization: CODYZEA,
    organizationUrl: CODYZEA_URL,
    category: "contract",
    status: "offline",
    platforms: ["web"],
    year: "2024",
  },
  {
    slug: "ceylonmoss",
    title: "Ceylonmoss",
    tagline: "Moss art and vertical gardens storefront",
    description:
      "A showcase site for a moss-art and vertical-garden studio: a hero slider, categorised gallery, product pages, blog and Q&A. Led as a team project at CodyZea.",
    role: "Team Lead (contract)",
    organization: CODYZEA,
    organizationUrl: CODYZEA_URL,
    category: "contract",
    status: "offline",
    platforms: ["web"],
    image: {
      src: "/works/ceylonmoss.webp",
      alt: "Ceylonmoss website on a laptop and phone: Nature's Green Elegance",
      fit: "contain",
      background: "#0b120d",
    },
    year: "2024",
  },
  {
    slug: "codyzea-luxury-pos",
    title: "Luxury POS System",
    tagline: "Touch-first point of sale for a premium retailer",
    description:
      "A point-of-sale for a luxury retail brand: a product grid built for speed, a live cart summary with discount, tax and service charge, gift cards and refunds. Built with the CodyZea team.",
    role: "Team Lead (contract)",
    organization: CODYZEA,
    organizationUrl: CODYZEA_URL,
    category: "contract",
    status: "private",
    platforms: ["web"],
    image: {
      src: "/works/codyzea-luxury-pos.webp",
      alt: "Luxury POS interface with product grid and cart summary",
    },
    year: "2024",
  },
];

const IMAGINECOREX = "ImaginecoreX PVT Ltd";

const imaginecorexProjects: Project[] = [
  {
    slug: "downsouth-lms",
    title: "DownSouth LMS",
    tagline: "Learning management system, built from scratch",
    description:
      "A full learning management system built from the ground up with a small team: a Next.js frontend and a NestJS and Prisma backend, containerised with Docker.",
    role: "Software Engineer (part-time, internship)",
    organization: IMAGINECOREX,
    category: "internship",
    status: "private",
    platforms: ["web"],
    tech: ["Next.js", "NestJS", "Prisma", "Docker", "Tailwind CSS"],
    year: "2024",
  },
  {
    slug: "udocs",
    title: "uDocs",
    tagline: "Turn photos into shareable PDFs",
    description:
      "A mobile app that turns photos into clean PDF documents in a couple of taps, built with Expo and React Native on a Supabase backend.",
    role: "Software Engineer (part-time, internship)",
    organization: IMAGINECOREX,
    category: "internship",
    status: "private",
    platforms: ["android", "ios"],
    tech: ["Expo", "React Native", "Supabase", "NativeWind"],
    year: "2024",
  },
  {
    slug: "ascaorigin",
    title: "Ascaorigin",
    tagline: "Concept website for a design company",
    description:
      "A concept website for a design company, built to show how a creative studio can present its story and work with a fast, modern Next.js frontend.",
    role: "Software Engineer (part-time, internship)",
    organization: IMAGINECOREX,
    category: "internship",
    status: "private",
    platforms: ["web"],
    tech: ["Next.js", "TypeScript", "Tailwind CSS"],
    year: "2024",
  },
];

const QUANTUM = "Quantum Cod PVT Ltd";
const QUANTUM_URL = "https://quantumcod.com";

const quantumCodProjects: Project[] = [
  {
    slug: "teamalpha",
    title: "Team Alpha Engineering",
    tagline: "Corporate website for an engineering firm",
    description:
      "A company website for an engineering firm: a confident headline, clear services, news and updates, and a projects page, all easy to scan on a phone.",
    role: "Software Engineer (contract)",
    organization: QUANTUM,
    organizationUrl: QUANTUM_URL,
    category: "contract",
    status: "live",
    platforms: ["web"],
    links: [{ kind: "website", url: "https://teamalpha.lk/" }],
    image: {
      src: "/works/teamalpha.webp",
      alt: "Team Alpha Engineering home page: Innovative Engineering, Endless Solutions",
      position: "50% 0%",
    },
    year: "2023",
  },
  {
    slug: "serene-hiriketiya",
    title: "Serene Villa Hiriketiya",
    tagline: "Villa website with a booking search up front",
    description:
      "A website for a Hiriketiya villa: rooms, amenities and a check-in and check-out search on the very first screen, so a visitor can plan a stay without hunting for it.",
    role: "Software Engineer (contract)",
    organization: QUANTUM,
    organizationUrl: QUANTUM_URL,
    category: "contract",
    status: "live",
    platforms: ["web"],
    links: [{ kind: "website", url: "https://serenehiriketiya.com/" }],
    image: {
      src: "/works/serene-hiriketiya.webp",
      alt: "Serene Villa Hiriketiya home page with check-in and check-out search",
      position: "50% 0%",
    },
    year: "2023",
  },
  {
    slug: "d-bone",
    title: "D-Bone Inventory",
    tagline: "Inventory management system for a wholesale business",
    description:
      "An inventory management system that shows sales against purchases, low-stock alerts per warehouse and top-selling products at a glance. A frontend demo is available to click through.",
    role: "Software Engineer (contract)",
    organization: QUANTUM,
    organizationUrl: QUANTUM_URL,
    category: "contract",
    status: "demo",
    platforms: ["web"],
    links: [
      { kind: "demo", url: "https://wizebiz.vercel.app/", label: "Frontend demo" },
      {
        kind: "casestudy",
        url: "https://quantumcod.com/portfolio/d-bone/",
        label: "Case study",
      },
    ],
    image: {
      src: "/works/d-bone.webp",
      alt: "D-Bone inventory dashboard with sales, purchases and stock alerts",
    },
    year: "2023",
  },
  {
    slug: "ceylon-harvest-pos",
    title: "Ceylon Harvest POS",
    tagline: "Point-of-sale system, built from scratch",
    description:
      "A point-of-sale system built from scratch for Ceylon Harvest: fast checkout, sales lists with payment status and date-range sale reports that export to PDF.",
    role: "Software Engineer (contract)",
    organization: QUANTUM,
    organizationUrl: QUANTUM_URL,
    category: "contract",
    status: "private",
    platforms: ["web"],
    links: [
      {
        kind: "casestudy",
        url: "https://quantumcod.com/portfolio/ceylon-harvest-product/",
        label: "Case study",
      },
    ],
    image: {
      src: "/works/ceylon-harvest-pos.webp",
      alt: "Ceylon Harvest POS sale report over a sales list",
    },
    year: "2023",
  },
];

const freelanceProjects: Project[] = [
  {
    slug: "valorem",
    title: "Valorem",
    tagline: "Dubai real estate brokerage with a premium first impression",
    description:
      "A brand website for a Dubai real estate brokerage: a bold hero, property and project listings, trust signals and a consultation call-to-action on every screen.",
    role: "Freelance Full-Stack Developer",
    category: "freelance",
    status: "live",
    platforms: ["web"],
    links: [{ kind: "website", url: "https://valorem.ae" }],
    image: {
      src: "/works/valorem.webp",
      alt: "Valorem real estate brokers home page: Find your dream home",
      position: "50% 20%",
    },
    year: "2024",
  },
  {
    slug: "valorem-real-estate",
    title: "Valorem Real Estate",
    tagline: "Brokerage site built to win search and enquiries",
    description:
      "A second brokerage website for the Valorem group, tuned for search visibility with a clear message, fast pages and simple ways to get in touch.",
    role: "Freelance Full-Stack Developer",
    category: "freelance",
    status: "live",
    platforms: ["web"],
    links: [{ kind: "website", url: "https://valoremrealestate.ae" }],
    image: {
      src: "/works/valorem-real-estate.webp",
      alt: "Valorem Real Estate home page",
      position: "50% 20%",
    },
    year: "2024",
  },
  {
    slug: "questside",
    title: "QuestSide Real Estate",
    tagline: "Abu Dhabi brokerage and property management",
    description:
      "A website for an Abu Dhabi luxury brokerage and property manager, with services, listings and a 24/7 dispatcher line front and centre.",
    role: "Freelance Full-Stack Developer",
    category: "freelance",
    status: "live",
    platforms: ["web"],
    links: [{ kind: "website", url: "https://questside.ae" }],
    image: {
      src: "/works/questside.webp",
      alt: "QuestSide Real Estate home page",
      position: "50% 20%",
    },
    year: "2024",
  },
  {
    slug: "distress-properties",
    title: "Distress Properties in Dubai",
    tagline: "Off-market deals site that drives enquiries",
    description:
      "A focused website for below-market, off-market Dubai property deals: urgency and scarcity where they belong, and a straight path from the offer to a conversation.",
    role: "Freelance Full-Stack Developer",
    category: "freelance",
    status: "live",
    platforms: ["web"],
    links: [{ kind: "website", url: "https://distresspropertiesindubai.com" }],
    image: {
      src: "/works/distress-properties.webp",
      alt: "Distress Properties in Dubai home page",
      position: "50% 20%",
    },
    year: "2024",
  },
  {
    slug: "lakeview-villa-tangalle",
    title: "Lake View Villa Tangalle",
    tagline: "Boutique villa website that sells the stay",
    description:
      "A booking-focused website for a private lagoon villa in Tangalle, Sri Lanka: gallery, stays, visitor info and FAQ. A second, motion-rich design and a developer page sit alongside the main site.",
    role: "Freelance Full-Stack Developer",
    category: "freelance",
    status: "live",
    platforms: ["web"],
    links: [
      { kind: "website", url: "https://lakeviewvillatangalle.com" },
      {
        kind: "website",
        url: "https://d.lakeviewvillatangalle.com/",
        label: "Alternate design",
      },
      {
        kind: "website",
        url: "https://lakeviewvillatangalle.com/developer/",
        label: "Developer page",
      },
    ],
    image: {
      src: "/works/lakeview-villa.webp",
      alt: "Lake View Villa Tangalle home page",
      position: "50% 30%",
    },
    year: "2023",
  },
];

export const Projects: Project[] = [
  ...datalakeProducts,
  ...evisionProjects,
  ...codyzeaProjects,
  ...imaginecorexProjects,
  ...quantumCodProjects,
  ...freelanceProjects,
];

// "Datalake Creative Ltd" becomes "Datalake Creative"; no organization means
// it was a freelance engagement.
export const teamOf = (project: Project) =>
  (project.organization ?? "Freelance").replace(/\s+(PVT\s+)?Ltd\.?$/i, "");

// The first link is the primary action, so the card and the dialog agree.
export const primaryLink = (project: Project) => project.links?.[0];
