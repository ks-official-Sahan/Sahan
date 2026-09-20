import {
  Cloud,
  Database,
  Globe,
  LayoutDashboard,
  Palette,
  Plug,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Projects } from "@/contents/projects";
import type { ProjectCategory, ProjectPlatform } from "@/types/project";
import type { ServiceCategory } from "@/types/service";

// Counts are derived from `contents/projects.ts` so they stay true as the
// project list grows, instead of being hand-maintained numbers.
const countByCategory = (category: ProjectCategory) =>
  Projects.filter((project) => project.category === category).length;

const countByPlatform = (platform: ProjectPlatform) =>
  Projects.filter((project) => project.platforms?.includes(platform)).length;

const webProducts = Projects.filter(
  (project) =>
    project.category === "product" && project.platforms?.includes("web")
).length;

const categories: ServiceCategory[] = [
  {
    id: 1,
    name: "Engineering",
    services: [
      {
        id: "WEB",
        icon: Globe,
        name: "Web Development",
        description:
          "Building fast, responsive websites and web apps with React and Next.js, backed by Node.js, NestJS, Spring Boot, or Django.",
        done: {
          title: "Delivered",
          href: "/works",
          list: [
            { name: "Client websites", count: countByCategory("freelance") },
            { name: "Web products", count: webProducts },
          ],
        },
      },
      {
        id: "XPL",
        icon: Smartphone,
        name: "Cross-Platform Products",
        description:
          "Shipping Android, iOS, web, and admin experiences that share one product vision across every platform.",
        done: {
          title: "Built at Datalake Creative",
          href: "/works",
          list: [
            { name: "Android & iOS apps", count: countByPlatform("android") },
            { name: "Web admin panels", count: countByPlatform("web-admin") },
          ],
        },
      },
      {
        id: "DSH",
        icon: LayoutDashboard,
        name: "Dashboards & Admin Panels",
        description:
          "Internal tools for managing content, users, and data, including multi-account media management and content tooling with versioned snapshots.",
      },
      {
        id: "API",
        icon: Plug,
        name: "APIs & Integrations",
        description:
          "Designing APIs, such as property-finder APIs, and integrating third-party services like Cloudinary for media management.",
      },
    ],
  },
  {
    id: 2,
    name: "Cloud & Reliability",
    services: [
      {
        id: "CLD",
        icon: Cloud,
        name: "Deployment & Hosting",
        description:
          "Deploying on Vercel, Cloudflare, and Azure, containerising with Docker, and adding Redis caching where it pays off.",
      },
      {
        id: "DAT",
        icon: Database,
        name: "Data & Backups",
        description:
          "Designing schemas on PostgreSQL, MySQL, and MongoDB, with backup and sync flows that include fallback strategies.",
      },
      {
        id: "SEC",
        icon: ShieldCheck,
        name: "Security & Access",
        description:
          "Building security-hardened flows such as multi-factor authentication (MFA) and scheduled maintenance jobs.",
      },
    ],
  },
  {
    id: 3,
    name: "Design",
    services: [
      {
        id: "UXD",
        icon: Palette,
        name: "UI/UX Design",
        description:
          "Turning ideas into clean, usable interfaces, prototyped in Figma before they are built.",
      },
    ],
  },
];

export const MyServices = { categories };
