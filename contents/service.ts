import {
  Boxes,
  Cloud,
  Code2,
  Compass,
  Container,
  Database,
  FileText,
  Globe,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Monitor,
  Palette,
  PenTool,
  Plug,
  Presentation,
  SearchCode,
  Server,
  ShieldCheck,
  Smartphone,
  Video,
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
    name: "Full-Stack Development",
    services: [
      {
        id: "WEB",
        icon: Globe,
        name: "Web Development",
        description:
          "Building fast, responsive websites and web apps with HTML, CSS, JavaScript, React, Next.js, and Angular.",
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
        id: "BCK",
        icon: Server,
        name: "Backend Development",
        description:
          "Setting up robust backends with Node.js, Express.js, NestJS, Spring Boot, Django, or Laravel, and managing data in MySQL, MongoDB, and PostgreSQL.",
      },
      {
        id: "API",
        icon: Plug,
        name: "API Development & Integration",
        description:
          "Designing RESTful and GraphQL APIs, such as property-finder APIs, and integrating third-party services like Cloudinary for media management.",
      },
      {
        id: "APP",
        icon: Smartphone,
        name: "Cross-Platform Mobile Apps",
        description:
          "Shipping Android and iOS apps, with web and admin experiences that share one product vision across every platform.",
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
        id: "PWA",
        icon: Layers,
        name: "Progressive Web Apps",
        description:
          "Creating PWAs for a seamless mobile and desktop experience using Next.js and React.",
      },
      {
        id: "DSH",
        icon: LayoutDashboard,
        name: "Dashboards & Admin Panels",
        description:
          "Internal tools for managing content, users, and data, including multi-account media management and content tooling with versioned snapshots.",
      },
      {
        id: "DSK",
        icon: Monitor,
        name: "Desktop Applications",
        description:
          "Building cross-platform desktop applications with Electron.js for tools, utilities, or business software.",
      },
    ],
  },
  {
    id: 2,
    name: "DevOps & Cloud",
    services: [
      {
        id: "CLD",
        icon: Container,
        name: "Containerization & Deployment",
        description:
          "Deploying with Docker, setting up CI/CD pipelines with Git, and shipping to Vercel, Cloudflare, or Azure, with Redis caching where it pays off.",
      },
      {
        id: "CCH",
        icon: Cloud,
        name: "Cloud Consulting & Hosting",
        description:
          "Solutions for hosting, scaling, and managing applications in the cloud, including migration to cloud platforms.",
      },
      {
        id: "DAT",
        icon: Database,
        name: "Database Management & Optimization",
        description:
          "Database design, optimization, and maintenance with MySQL, PostgreSQL, MongoDB, and Prisma, plus backup and sync flows with fallback strategies.",
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
    name: "UI/UX & Graphic Design",
    services: [
      {
        id: "UXD",
        icon: Palette,
        name: "UI/UX Design",
        description:
          "Designing clean, modern, user-friendly interfaces for web and mobile, prototyped in Figma before they are built.",
      },
      {
        id: "BRD",
        icon: PenTool,
        name: "Brand Identity & Logo Design",
        description:
          "Crafting brand identities, logos, and brand assets that fit a company's values and audience.",
      },
      {
        id: "MCK",
        icon: Boxes,
        name: "Website & App Mockups",
        description:
          "Creating wireframes, prototypes, and high-fidelity mockups for web and mobile applications.",
      },
      {
        id: "PPD",
        icon: Presentation,
        name: "Presentation & Proposal Design",
        description:
          "Designing professional documents, proposals, and presentations for business or academic purposes.",
      },
    ],
  },
  {
    id: 4,
    name: "Multimedia & Content",
    services: [
      {
        id: "PVE",
        icon: Video,
        name: "Photo & Video Editing",
        description:
          "Editing photos for marketing and branding, and cutting videos for social media or business.",
      },
      {
        id: "DWF",
        icon: FileText,
        name: "Document Writing & Formatting",
        description:
          "Writing, editing, and formatting reports, technical documentation, user manuals, and other professional documents.",
      },
      {
        id: "CCI",
        icon: Lightbulb,
        name: "Content Creation & Idea Generation",
        description:
          "Content ideas, creative direction, and concepts for digital marketing campaigns or branding projects.",
      },
    ],
  },
  {
    id: 5,
    name: "Consulting & Mentoring",
    services: [
      {
        id: "CNS",
        icon: Compass,
        name: "Software Consulting",
        description:
          "Advising on the best technology stack, project structure, and development practices for your requirements.",
      },
      {
        id: "CRO",
        icon: SearchCode,
        name: "Code Review & Optimization",
        description:
          "Reviewing code for quality, performance, and security, with clear recommendations for improvement.",
      },
      {
        id: "PPS",
        icon: Code2,
        name: "Project Planning & Strategy",
        description:
          "Helping outline project goals, timelines, and tech stacks, with roadmaps and estimates.",
      },
      {
        id: "MNT",
        icon: GraduationCap,
        name: "Mentorship & Training",
        description:
          "Tutorials, workshops, and one-on-one sessions in web development, cloud, databases, or design.",
      },
    ],
  },
];

export const MyServices = { categories };
