// Copy for the works page. The projects themselves live in
// `contents/projects.ts`; nothing here claims more than that list does.
export const WorksContent = {
  hero: {
    status: "Products and client sites",
    title: "Work I have built and shipped.",
    description:
      "App-store products, client websites and the business systems behind them, such as POS and inventory. Open any project for its links and the story.",
  },
  // Same idea as the neth works page (two kinds of work), matched to the kinds
  // of work that actually exist here. `param` keeps old ?wt= links working.
  tabs: [
    { id: "all", label: "All work", param: "all" },
    { id: "products", label: "Products", param: "pro" },
    { id: "client", label: "Client work", param: "des" },
  ],
  results: {
    empty: "Nothing to show for this filter yet.",
  },
  behind: {
    title: "Behind the work",
    subtitle: "The kind of problems these projects involved, and the tools used to solve them.",
    capabilitiesLabel: "What I built across these products",
    stackLabel: "The stack behind them",
    // Each item is taken from the experience page.
    capabilities: [
      "Cross-platform apps (Android, iOS, web)",
      "Dashboards and admin panels",
      "Property-finder APIs",
      "AI-assisted content tooling",
      "Multi-account Cloudinary media",
      "Redis caching",
      "Database backup and sync with fallbacks",
      "Multi-factor authentication",
      "Versioned content snapshots",
      "Scheduled cron jobs",
      "Client websites",
      "Booking-focused sites",
      "Point-of-sale systems",
      "Inventory management",
      "Learning management system",
    ],
    // Looked up by name in `contents/skills.ts`.
    stack: [
      "Next.js",
      "React",
      "TypeScript",
      "Node.js",
      "NestJS",
      "Express",
      "PostgreSQL",
      "MongoDB",
      "Prisma",
      "Docker",
      "Vercel",
      "Cloudflare",
      "Figma",
      "Tailwind CSS",
    ],
  },
};
