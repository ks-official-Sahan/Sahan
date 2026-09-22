import { defineSection, group, longtext, text } from "@/lib/cms/define";
import { long, optStr, str, strings } from "@/lib/cms/schema-parts";
import { AboutContent } from "@/contents/about";
import { HomeContent } from "@/contents/home";
import { z } from "zod";

// Sections of the about page (docs/plan/admin-cms-adr.md, section 8).

const heroSchema = z.object({
  titleLine1: str(60),
  titleLine2: str(60),
  description: long(400),
  primaryLabel: str(30),
  secondaryLabel: str(30),
});

const bentoSchema = z.object({
  title: str(100),
  cardTitle: str(60),
  cardDescription: long(300),
  companiesLabel: str(50),
  freelanceLabel: str(50),
  availabilityStatus: str(50),
  emailLabel: str(30),
  messageLabel: str(30),
  githubLabel: str(50),
  githubContributionsLabel: str(30),
  githubReposLabel: str(30),
  githubFollowersLabel: str(30),
  githubNote: str(100),
});

const experienceSchema = z.object({
  title: str(60),
  description: long(250),
  typeLabelFulltime: str(20),
  typeLabelContract: str(20),
  typeLabelParttime: str(20),
  typeLabelInternship: str(20),
  typeLabelFreelance: str(20),
  currentBadge: str(20),
});

const servicesSchema = z.object({
  title: str(60),
  subtitle: str(100),
  marqueeLabel: str(30),
  ctaLabel: str(30),
});

const skillsSchema = z.object({
  title: str(100),
  description: str(100),
});

export const aboutSections = {
  hero: defineSection({
    page: "about",
    key: "hero",
    label: "Hero Section",
    description: "Main introduction with name, roles, and call-to-action buttons",
    schema: heroSchema,
    fields: [
      text("titleLine1", "Title Line 1", { maxLength: 60, placeholder: "Innovator. Entrepreneur." }),
      text("titleLine2", "Title Line 2", { maxLength: 60, placeholder: "Software Engineer." }),
      longtext("description", "Description", { maxLength: 400, rows: 4 }),
      text("primaryLabel", "Primary Button", { maxLength: 30, placeholder: "Start a project" }),
      text("secondaryLabel", "Secondary Button", { maxLength: 30, placeholder: "See my work" }),
    ],
    defaults: () => ({
      titleLine1: AboutContent.SE1.title.line1,
      titleLine2: AboutContent.SE1.title.line2,
      description: AboutContent.SE1.description,
      primaryLabel: "Start a project",
      secondaryLabel: "See my work",
    }),
    consumers: ["/about"],
  }),

  bento: defineSection({
    page: "about",
    key: "bento",
    label: "Story Bento Section",
    description: "Grid of cards: about story, current role, numbers, GitHub stats, and availability",
    schema: bentoSchema,
    fields: [
      text("title", "Section Title", { maxLength: 100, placeholder: "A bit about me" }),
      text("cardTitle", "Story Card Title", { maxLength: 60, placeholder: "Who I Am" }),
      longtext("cardDescription", "Story Card Description", { maxLength: 300, rows: 3 }),
      text("companiesLabel", "Companies Count Label", { maxLength: 50, placeholder: "Companies and teams worked with" }),
      text("freelanceLabel", "Freelance Count Label", { maxLength: 50, placeholder: "Freelance projects delivered" }),
      text("availabilityStatus", "Availability Status", { maxLength: 50, placeholder: "Available for remote work" }),
      text("emailLabel", "Email Button", { maxLength: 30, placeholder: "Email me" }),
      text("messageLabel", "Message Button", { maxLength: 30, placeholder: "Send a message" }),
      text("githubLabel", "GitHub Card Label", { maxLength: 50, placeholder: "GitHub Activity" }),
      text("githubContributionsLabel", "GitHub Contributions Stat", { maxLength: 30, placeholder: "Contributions" }),
      text("githubReposLabel", "GitHub Repos Stat", { maxLength: 30, placeholder: "Public Repos" }),
      text("githubFollowersLabel", "GitHub Followers Stat", { maxLength: 30, placeholder: "Followers" }),
      text("githubNote", "GitHub Note", { maxLength: 100, placeholder: "Contributions counted over the last year" }),
    ],
    defaults: () => ({
      title: "A bit about me",
      cardTitle: AboutContent.bento.B1.title,
      cardDescription: AboutContent.bento.B1.description,
      companiesLabel: "Companies and teams worked with",
      freelanceLabel: "Freelance projects delivered",
      availabilityStatus: "Available for remote work",
      emailLabel: "Email me",
      messageLabel: "Send a message",
      githubLabel: "GitHub Activity",
      githubContributionsLabel: "Contributions",
      githubReposLabel: "Public Repos",
      githubFollowersLabel: "Followers",
      githubNote: "Contributions counted over the last year",
    }),
    consumers: ["/about"],
  }),

  services: defineSection({
    page: "about",
    key: "services",
    label: "Services Section",
    description: "Services overview with marquee and category selection",
    schema: servicesSchema,
    fields: [
      text("title", "Section Title", { maxLength: 60 }),
      text("subtitle", "Section Subtitle", { maxLength: 100 }),
      text("marqueeLabel", "Marquee Label", { maxLength: 30, placeholder: "All services" }),
      text("ctaLabel", "Call-to-action Button", { maxLength: 30, placeholder: "Discuss a project" }),
    ],
    defaults: () => ({
      title: HomeContent.service.title,
      subtitle: HomeContent.service.subtitle,
      marqueeLabel: "All services",
      ctaLabel: "Discuss a project",
    }),
    consumers: ["/about"],
  }),

  skills: defineSection({
    page: "about",
    key: "skills",
    label: "Skills Section",
    description: "Technical skills overview with layout toggle",
    schema: skillsSchema,
    fields: [
      text("title", "Section Title", { maxLength: 100 }),
      text("description", "Section Subtitle", { maxLength: 100 }),
    ],
    defaults: () => ({
      title: AboutContent.KB.title,
      description: AboutContent.KB.description,
    }),
    consumers: ["/about"],
  }),

  experience: defineSection({
    page: "about",
    key: "experience",
    label: "Experience Section",
    description: "Work experience ledger with employment type badges",
    schema: experienceSchema,
    fields: [
      text("title", "Section Title", { maxLength: 60, placeholder: "Work experience" }),
      longtext("description", "Section Description", { maxLength: 250, rows: 2 }),
      text("typeLabelFulltime", "Full-time Label", { maxLength: 20, placeholder: "Full-time" }),
      text("typeLabelContract", "Contract Label", { maxLength: 20, placeholder: "Contract" }),
      text("typeLabelParttime", "Part-time Label", { maxLength: 20, placeholder: "Part-time" }),
      text("typeLabelInternship", "Internship Label", { maxLength: 20, placeholder: "Internship" }),
      text("typeLabelFreelance", "Freelance Label", { maxLength: 20, placeholder: "Freelance" }),
      text("currentBadge", "Current Role Badge", { maxLength: 20, placeholder: "Current" }),
    ],
    defaults: () => ({
      title: "Work experience",
      description: "Companies and engagements I have worked with, from full-time roles to contract and freelance projects.",
      typeLabelFulltime: "Full-time",
      typeLabelContract: "Contract",
      typeLabelParttime: "Part-time",
      typeLabelInternship: "Internship",
      typeLabelFreelance: "Freelance",
      currentBadge: "Current",
    }),
    consumers: ["/about"],
  }),
} as const;
