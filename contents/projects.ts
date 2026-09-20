import { Project } from "@/types/project";

// Products engineered as part of the Datalake Creative team. These are
// private, commercial products — screenshots/logos are intentionally left
// out until real brand assets are available to publish.
const datalakeProducts: Project[] = [
  {
    slug: "wizzie-words",
    title: "Wizzie Words: Dictionary",
    tagline: "Cross-platform dictionary app",
    description:
      "A cross-platform dictionary product spanning Android, iOS, web, and a web-based admin panel, built and maintained as part of the Datalake Creative engineering team.",
    role: "Software Engineer",
    organization: "Datalake Creative Ltd",
    organizationUrl: "https://datalakecreative.com",
    category: "product",
    platforms: ["android", "ios", "web", "web-admin"],
    year: "2025",
    private: true,
    featured: true,
  },
  {
    slug: "reaktu",
    title: "Reaktu",
    tagline: "Cross-platform product suite",
    description:
      "A cross-platform product spanning Android, iOS, web, and a web-based admin panel, built and maintained as part of the Datalake Creative engineering team.",
    role: "Software Engineer",
    organization: "Datalake Creative Ltd",
    organizationUrl: "https://datalakecreative.com",
    category: "product",
    platforms: ["android", "ios", "web", "web-admin"],
    year: "2025",
    private: true,
  },
  {
    slug: "channel-direct",
    title: "Channel Direct",
    tagline: "Cross-platform product suite",
    description:
      "A cross-platform product spanning Android, iOS, web, and a web-based admin panel, built and maintained as part of the Datalake Creative engineering team.",
    role: "Software Engineer",
    organization: "Datalake Creative Ltd",
    organizationUrl: "https://datalakecreative.com",
    category: "product",
    platforms: ["android", "ios", "web", "web-admin"],
    year: "2025",
    private: true,
  },
  {
    slug: "meto-finance",
    title: "Meto Finance",
    tagline: "Cross-platform finance app",
    description:
      "A finance product spanning Android, iOS, web, and a web-based admin panel, built and maintained as part of the Datalake Creative engineering team.",
    role: "Software Engineer",
    organization: "Datalake Creative Ltd",
    organizationUrl: "https://datalakecreative.com",
    category: "product",
    platforms: ["android", "ios", "web", "web-admin"],
    year: "2025",
    private: true,
  },
  {
    slug: "hatchy",
    title: "Hatchy",
    tagline: "Multi-tenant project management tool",
    description:
      "A multi-tenant project management tool for Android, iOS, and web, built and maintained as part of the Datalake Creative engineering team.",
    role: "Software Engineer",
    organization: "Datalake Creative Ltd",
    organizationUrl: "https://datalakecreative.com",
    category: "product",
    platforms: ["android", "ios", "web"],
    year: "2025",
    private: true,
    featured: true,
  },
];

const freelanceProjects: Project[] = [
  {
    slug: "valorem",
    title: "Valorem",
    tagline: "Real estate brand website",
    description:
      "A marketing website for the Valorem real estate brand in the UAE, delivered as a freelance engagement.",
    role: "Freelance Full-Stack Developer",
    category: "freelance",
    platforms: ["web"],
    url: "https://valorem.ae",
    year: "2024",
  },
  {
    slug: "valorem-real-estate",
    title: "Valorem Real Estate",
    tagline: "Property listings & real estate site",
    description:
      "A real estate listings website for a UAE-based property business, delivered as a freelance engagement.",
    role: "Freelance Full-Stack Developer",
    category: "freelance",
    platforms: ["web"],
    url: "https://valoremrealestate.ae",
    year: "2024",
  },
  {
    slug: "questside",
    title: "Questside",
    tagline: "Business website, UAE",
    description:
      "A business website built for a UAE-based client, delivered as a freelance engagement.",
    role: "Freelance Full-Stack Developer",
    category: "freelance",
    platforms: ["web"],
    url: "https://questside.ae",
    year: "2024",
  },
  {
    slug: "lakeview-villa-tangalle",
    title: "Lakeview Villa Tangalle",
    tagline: "Boutique villa website, Sri Lanka",
    description:
      "A booking-focused website for a boutique villa in Tangalle, Sri Lanka, delivered as a freelance engagement.",
    role: "Freelance Full-Stack Developer",
    category: "freelance",
    platforms: ["web"],
    url: "https://lakeviewvillatangalle.com",
    year: "2023",
  },
];

const contractProjects: Project[] = [
  {
    slug: "quantum-cod-pos",
    title: "POS System",
    tagline: "Point-of-sale system",
    description:
      "A point-of-sale system built during a contract engagement with Quantum Cod.",
    role: "Software Engineer (Contract)",
    organization: "Quantum Cod PVT Ltd",
    category: "contract",
    platforms: ["web"],
    year: "2023",
  },
];

export const Projects: Project[] = [
  ...datalakeProducts,
  ...freelanceProjects,
  ...contractProjects,
];

export const ProjectFilters = [
  { label: "All", value: "all" },
  { label: "Products", value: "product" },
  { label: "Freelance", value: "freelance" },
  { label: "Contract", value: "contract" },
] as const;
