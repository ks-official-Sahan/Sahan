import { z } from "zod";
import { HomeContent } from "@/contents/home";
import { defineSection } from "@/lib/cms/define";
import { str, long, optLong, href, linkSchema, strings, items } from "@/lib/cms/schema-parts";

// Icon options for Why section benefits
const whyIconOptions = [
  { value: "layers", label: "Layers" },
  { value: "smartphone", label: "Smartphone" },
  { value: "shield", label: "Shield" },
  { value: "globe", label: "Globe" },
] as const;

// Hero section
export const heroSection = defineSection({
  page: "home",
  key: "hero",
  label: "Hero",
  description: "Top section with status, headline, and primary actions",
  schema: z.object({
    status: str(50),
    title: str(100),
    subtitle: str(150),
    primary: linkSchema,
    secondary: linkSchema,
  }),
  fields: [
    { kind: "text", key: "status", label: "Status badge", maxLength: 50 },
    { kind: "text", key: "title", label: "Headline", maxLength: 100 },
    { kind: "text", key: "subtitle", label: "Tagline", maxLength: 150, help: "Site.myRole and Site.org are interpolated at render time" },
    { kind: "link", key: "primary", label: "Primary button" },
    { kind: "link", key: "secondary", label: "Secondary button" },
  ],
  defaults: () => ({ ...HomeContent.hero }),
  consumers: ["/"],
  editPermission: "editPages",
  publishPermission: "publishPages",
});

// IAm (role rotator) section
export const iamSection = defineSection({
  page: "home",
  key: "iam",
  label: "I'm a... (role rotator)",
  description: "Words that rotate to show different roles",
  schema: z.object({
    prefix: str(20),
    words: strings(1, 12, 30),
    hint: str(50),
  }),
  fields: [
    { kind: "text", key: "prefix", label: "Prefix label", maxLength: 20, help: "Shows before the rotating word" },
    { kind: "stringList", key: "words", label: "Role words", itemLabel: "Role", min: 1, max: 12, maxLength: 30 },
    { kind: "text", key: "hint", label: "Interaction hint", maxLength: 50 },
  ],
  defaults: () => ({
    prefix: "I'm a",
    words: [
      "Full-stack engineer",
      "Next.js builder",
      "Mobile app developer",
      "Dashboard maker",
      "API designer",
      "Remote teammate",
    ],
    hint: "Tap for another",
  }),
  consumers: ["/"],
  editPermission: "editPages",
  publishPermission: "publishPages",
});

// Channels (contact options) section
export const channelsSection = defineSection({
  page: "home",
  key: "channels",
  label: "Contact channels",
  description: "WhatsApp, Telegram, and Email direct links",
  schema: z.object({
    title: str(50),
    whatsApp: z.object({ label: str(20), detail: str(50) }),
    telegram: z.object({ label: str(20), detail: str(50) }),
    email: z.object({ label: str(20), detail: str(100) }),
    newTab: str(50),
  }),
  fields: [
    { kind: "text", key: "title", label: "Section title", maxLength: 50 },
    { kind: "group", key: "whatsApp", label: "WhatsApp channel", fields: [
      { kind: "text", key: "label", label: "Channel name", maxLength: 20 },
      { kind: "text", key: "detail", label: "Action text", maxLength: 50 },
    ]},
    { kind: "group", key: "telegram", label: "Telegram channel", fields: [
      { kind: "text", key: "label", label: "Channel name", maxLength: 20 },
      { kind: "text", key: "detail", label: "Action text", maxLength: 50 },
    ]},
    { kind: "group", key: "email", label: "Email channel", fields: [
      { kind: "text", key: "label", label: "Channel name", maxLength: 20 },
      { kind: "text", key: "detail", label: "Email address (Site.email interpolated at render time)", maxLength: 100 },
    ]},
    { kind: "text", key: "newTab", label: "Screen reader label for external links", maxLength: 50 },
  ],
  defaults: () => ({ ...HomeContent.channels }),
  consumers: ["/", "/about", "/works", "/updates"],
  editPermission: "editPages",
  publishPermission: "publishPages",
});

// Teams marquee section
export const teamsSection = defineSection({
  page: "home",
  key: "teams",
  label: "Teams marquee label",
  description: "Label for the scrolling list of team and project names",
  schema: z.object({
    label: str(100),
  }),
  fields: [
    { kind: "text", key: "label", label: "Marquee label", maxLength: 100 },
  ],
  defaults: () => ({
    label: "Built with teams and for clients",
  }),
  consumers: ["/"],
  editPermission: "editPages",
  publishPermission: "publishPages",
});

// Proof strip section
export const proofSection = defineSection({
  page: "home",
  key: "proof",
  label: "Proof strip",
  description: "Label for the statistics section (stat values are derived from data)",
  schema: z.object({
    label: str(50),
  }),
  fields: [
    { kind: "text", key: "label", label: "Section label (ARIA)", maxLength: 50 },
  ],
  defaults: () => ({
    label: "Track record",
  }),
  consumers: ["/", "/about"],
  editPermission: "editPages",
  publishPermission: "publishPages",
});

// Why people hire me section
const whyPointSchema = z.object({
  icon: z.enum(["layers", "smartphone", "shield", "globe"]),
  title: str(60),
  body: long(300),
});

export const whySection = defineSection({
  page: "home",
  key: "why",
  label: "Why people hire me",
  description: "Benefits and reasons, one per icon",
  schema: z.object({
    title: str(80),
    subtitle: str(150),
    points: items(whyPointSchema, 1, 8),
  }),
  fields: [
    { kind: "text", key: "title", label: "Section title", maxLength: 80 },
    { kind: "text", key: "subtitle", label: "Section subtitle", maxLength: 150 },
    { kind: "list", key: "points", label: "Benefits", itemLabel: "Benefit", min: 1, max: 8, fields: [
      { kind: "select", key: "icon", label: "Icon", options: whyIconOptions },
      { kind: "text", key: "title", label: "Benefit title", maxLength: 60 },
      { kind: "longtext", key: "body", label: "Benefit description", maxLength: 300, rows: 3 },
    ]},
  ],
  defaults: () => ({
    title: "Why people hire me",
    subtitle: "What you get when one engineer owns the whole product.",
    points: [
      {
        icon: "layers" as const,
        title: "One engineer, the whole product",
        body: "Interface, API, database and deployment from one person, so nothing gets lost between handoffs.",
      },
      {
        icon: "smartphone" as const,
        title: "Shipped on every platform",
        body: "Android, iOS, web and admin panels. The work on this page is proof, not a promise.",
      },
      {
        icon: "shield" as const,
        title: "Built to keep running",
        body: "Backups with fallbacks, versioned content snapshots, caching and multi-factor sign-in: the unglamorous parts that keep a product alive.",
      },
      {
        icon: "globe" as const,
        title: "Easy to work with from anywhere",
        body: "Remote by default, currently with a UK-based team. Clear updates and working builds along the way.",
      },
    ],
  }),
  consumers: ["/"],
  editPermission: "editPages",
  publishPermission: "publishPages",
});

// Home nested sections (works, services, process, toolbox, faq labels)
const homeSectionLabelsSchema = z.object({
  works: z.object({ title: str(60), subtitle: long(150), buttonTitle: str(40) }),
  services: z.object({ title: str(60), subtitle: long(150) }),
  process: z.object({ title: str(60), subtitle: long(150) }),
  toolbox: z.object({ title: str(60), subtitle: long(150) }),
  faq: z.object({ title: str(60), subtitle: long(150) }),
});

export const homeSectionLabelsDefinition = defineSection({
  page: "home",
  key: "home",
  label: "Section labels",
  description: "Headings and descriptions for Works, Services, Process, Toolbox, and FAQ sections",
  schema: homeSectionLabelsSchema,
  fields: [
    { kind: "group", key: "works", label: "Works section", fields: [
      { kind: "text", key: "title", label: "Section title", maxLength: 60 },
      { kind: "longtext", key: "subtitle", label: "Section description", maxLength: 150, rows: 2 },
      { kind: "text", key: "buttonTitle", label: "\"See all\" button label", maxLength: 40 },
    ]},
    { kind: "group", key: "services", label: "Services section", fields: [
      { kind: "text", key: "title", label: "Section title", maxLength: 60 },
      { kind: "longtext", key: "subtitle", label: "Section description", maxLength: 150, rows: 2 },
    ]},
    { kind: "group", key: "process", label: "Process section", fields: [
      { kind: "text", key: "title", label: "Section title", maxLength: 60 },
      { kind: "longtext", key: "subtitle", label: "Section description", maxLength: 150, rows: 2 },
    ]},
    { kind: "group", key: "toolbox", label: "Toolbox section", fields: [
      { kind: "text", key: "title", label: "Section title", maxLength: 60 },
      { kind: "longtext", key: "subtitle", label: "Section description", maxLength: 150, rows: 2 },
    ]},
    { kind: "group", key: "faq", label: "FAQ section", fields: [
      { kind: "text", key: "title", label: "Section title", maxLength: 60 },
      { kind: "longtext", key: "subtitle", label: "Section description", maxLength: 150, rows: 2 },
    ]},
  ],
  defaults: () => ({
    ...HomeContent.home,
    works: { ...HomeContent.home.works, buttonTitle: HomeContent.works.buttonTitle },
  }),
  consumers: ["/"],
  editPermission: "editPages",
  publishPermission: "publishPages",
});

// Process section (step-by-step project flow)
const processStepSchema = z.object({
  title: str(40),
  body: long(200),
});

export const processSection = defineSection({
  page: "home",
  key: "process",
  label: "Process steps",
  description: "The four-step project workflow",
  schema: z.object({
    steps: items(processStepSchema, 2, 8),
  }).strict(),
  fields: [
    { kind: "list", key: "steps", label: "Steps", itemLabel: "Step", min: 2, max: 8, fields: [
      { kind: "text", key: "title", label: "Step title", maxLength: 40 },
      { kind: "longtext", key: "body", label: "Step description", maxLength: 200, rows: 2 },
    ]},
  ],
  defaults: () => ({
    steps: [
      {
        title: "Talk it through",
        body: "Send a short description of what you want to build. I reply with questions and a rough scope.",
      },
      {
        title: "Agree the plan",
        body: "We settle scope, screens and stack before any code is written, so there are no surprises later.",
      },
      {
        title: "Build in the open",
        body: "You see working builds early and often, not one big reveal at the end.",
      },
      {
        title: "Ship and support",
        body: "I deploy it, hand over the code, and stay available for fixes and next steps.",
      },
    ],
  }),
  consumers: ["/", "/contact"],
  editPermission: "editPages",
  publishPermission: "publishPages",
});

// Final CTA section
export const finalCtaSection = defineSection({
  page: "home",
  key: "finalCta",
  label: "Final CTA",
  description: "Closing call-to-action before contact channels",
  schema: z.object({
    title: str(100),
    subtitle: long(200),
    primary: linkSchema,
    copyLabel: str(40),
    copiedLabel: str(40),
  }),
  fields: [
    { kind: "text", key: "title", label: "Heading", maxLength: 100 },
    { kind: "longtext", key: "subtitle", label: "Description", maxLength: 200, rows: 2 },
    { kind: "link", key: "primary", label: "Button" },
    { kind: "text", key: "copyLabel", label: "Copy email button label", maxLength: 40 },
    { kind: "text", key: "copiedLabel", label: "Copy confirmation label", maxLength: 40 },
  ],
  defaults: () => ({
    title: "Have something you need built?",
    subtitle: "Tell me what you are working on. We can talk through scope, timing and the best way to build it.",
    primary: { label: "Start a project", href: "/contact" },
    copyLabel: "Copy email",
    copiedLabel: "Email copied",
  }),
  consumers: ["/", "/about", "/works", "/updates"],
  editPermission: "editPages",
  publishPermission: "publishPages",
});

// FAQ section (questions and answers)
const faqPointSchema = str(400);
const faqAnswerSchema = z.object({
  intro: long(300),
  points: z.array(faqPointSchema).max(8).optional(),
  outro: optLong(300).optional(),
});
const faqQuestionSchema = z.object({
  icon: str(20), // emoji or icon key
  question: str(150),
  answer: faqAnswerSchema,
}).strict();

export const faqSection = defineSection({
  page: "home",
  key: "faq",
  label: "FAQ",
  description: "Frequently asked questions with answers",
  schema: z.object({
    questions: items(faqQuestionSchema, 1, 20),
  }),
  fields: [
    { kind: "list", key: "questions", label: "Questions", itemLabel: "Question", min: 1, max: 20, fields: [
      { kind: "text", key: "icon", label: "Icon (emoji or key)", maxLength: 20 },
      { kind: "text", key: "question", label: "Question", maxLength: 150 },
      { kind: "group", key: "answer", label: "Answer", fields: [
        { kind: "longtext", key: "intro", label: "Intro text", maxLength: 300, rows: 2 },
        { kind: "stringList", key: "points", label: "Bullet points", itemLabel: "Point", min: 0, max: 8, maxLength: 400, multiline: true },
        { kind: "longtext", key: "outro", label: "Outro text (optional)", maxLength: 300, rows: 2, required: false },
      ]},
    ]},
  ],
  defaults: () => ({
    questions: HomeContent.faq.questions.map(({ icon, question, answer }) => ({
      icon,
      question,
      answer: { ...answer, points: answer.points ?? [] },
    })),
  }),
  consumers: ["/"],
  editPermission: "editPages",
  publishPermission: "publishPages",
});

// Export all sections for the registry
export const homeSections = {
  hero: heroSection,
  iam: iamSection,
  channels: channelsSection,
  teams: teamsSection,
  proof: proofSection,
  why: whySection,
  home: homeSectionLabelsDefinition,
  process: processSection,
  finalCta: finalCtaSection,
  faq: faqSection,
};
