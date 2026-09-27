import { z } from "zod";
import { defineSection, group, link, longtext, stringList, text } from "../define";
import { href, items, long, optLong, str, strings } from "../schema-parts";

// Sections of the works page. Filled in by the page module of step 9.
// Each section's `defaults()` adapts the current `contents/works.ts`.

export const worksSections = {
  hero: defineSection({
    page: "works",
    key: "hero",
    label: "Hero section",
    description: "Hero heading, status badge, and opening description",
    schema: z.object({
      status: str(100),
      title: str(100),
      description: long(500),
    }),
    fields: [
      text("status", "Status badge", { maxLength: 100 }),
      text("title", "Heading", { maxLength: 100 }),
      longtext("description", "Opening paragraph", {
        maxLength: 500,
        rows: 4,
      }),
    ],
    defaults: () => ({
      status: "Products and client sites",
      title: "Work I have built and shipped.",
      description:
        "App-store products, client websites and the business systems behind them, such as POS and inventory. Open any project for its links and the story.",
    }),
    consumers: ["/works"],
  }),

  tabs: defineSection({
    page: "works",
    key: "tabs",
    label: "Work tabs",
    description: 'Tab labels only. The tab id and param are fixed so old ?wt= links keep working.',
    schema: z.object({
      allLabel: str(50),
      productsLabel: str(50),
      clientLabel: str(50),
    }),
    fields: [
      text("allLabel", "All work tab label", { maxLength: 50, help: "e.g. All work" }),
      text("productsLabel", "Products tab label", { maxLength: 50, help: "e.g. Products" }),
      text("clientLabel", "Client work tab label", { maxLength: 50, help: "e.g. Client work" }),
    ],
    defaults: () => ({
      allLabel: "All work",
      productsLabel: "Products",
      clientLabel: "Client work",
    }),
    consumers: ["/works"],
  }),

  results: defineSection({
    page: "works",
    key: "results",
    label: "Results section",
    description: "Empty state message when no projects match the filter",
    schema: z.object({
      empty: str(200),
    }),
    fields: [
      text("empty", "Empty state message", {
        maxLength: 200,
        placeholder: "Shown when no projects match the current filter",
      }),
    ],
    defaults: () => ({
      empty: "Nothing to show for this filter yet.",
    }),
    consumers: ["/works"],
  }),

  behind: defineSection({
    page: "works",
    key: "behind",
    label: "Behind the work section",
    description: "Title, subtitle, and two lists (capabilities and stack)",
    schema: z.object({
      title: str(100),
      subtitle: long(300),
      capabilitiesLabel: str(100),
      stackLabel: str(100),
      capabilities: strings(5, 20, 100),
      stack: strings(3, 20, 100),
    }),
    fields: [
      text("title", "Section title", { maxLength: 100 }),
      longtext("subtitle", "Section subtitle", { maxLength: 300, rows: 3 }),
      text("capabilitiesLabel", "Capabilities label", {
        maxLength: 100,
        help: "e.g. What I built across these products",
      }),
      text("stackLabel", "Stack label", { maxLength: 100, help: "e.g. The stack behind them" }),
      stringList("capabilities", "Capabilities", {
        itemLabel: "capability",
        min: 5,
        max: 20,
        maxLength: 100,
        help: "A list of problems solved and features built. Shown in a scrolling marquee.",
      }),
      stringList("stack", "Stack", {
        itemLabel: "technology",
        min: 3,
        max: 20,
        maxLength: 100,
        help: "Technology names looked up in skills collection. A name with no match is silently skipped.",
      }),
    ],
    defaults: () => ({
      title: "Behind the work",
      subtitle: "The kind of problems these projects involved, and the tools used to solve them.",
      capabilitiesLabel: "What I built across these products",
      stackLabel: "The stack behind them",
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
    }),
    consumers: ["/works"],
  }),
} as const;
