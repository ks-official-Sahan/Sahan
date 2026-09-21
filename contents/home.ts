import { Site } from "@/config/site";
import type { FAQItem } from "@/types/faq";

// Every answer below is grounded in this site's own data (experience,
// projects and skills) so nothing here claims more than the rest of the
// portfolio already does.
const questions: FAQItem[] = [
  {
    id: 1,
    icon: "🟡",
    question: "What services do you offer?",
    answer: {
      intro:
        "I build software end to end, from the interface to the database and deployment. That includes:",
      points: [
        "Full-stack web development (Next.js, React, TypeScript)",
        "Cross-platform products spanning Android, iOS, web, and admin panels",
        "Dashboards and admin panels",
        "API development and third-party integrations",
        "Cloud deployment, caching, and data backup/sync",
      ],
    },
  },
  {
    id: 2,
    icon: "🔴",
    question: "What kinds of projects have you worked on?",
    answer: {
      intro: "My recent work spans a few different domains:",
      points: [
        "Real estate: brokerage and property-deal websites in the UAE",
        "Consumer apps: Wizzie Words (a dictionary) and Reaktu (a social platform), live in the app stores",
        "Finance and productivity: Meto, a finance app coming soon, and Hatchy, a project management tool",
        "Hospitality: booking-focused villa websites",
        "Retail and operations: point-of-sale and inventory management systems",
      ],
      outro: "The Works page has the full list.",
    },
  },
  {
    id: 3,
    icon: "🔵",
    question: "How can I collaborate with you on a project?",
    answer: {
      intro:
        "The easiest way is the Contact page. Send a short description of what you want to build and we can talk through the requirements from there.",
    },
  },
  {
    id: 4,
    icon: "🟢",
    question: "What technologies do you work with?",
    answer: {
      intro: "My day-to-day stack includes:",
      points: [
        "Frontend: Next.js, React, Angular, Redux",
        "Backend: Node.js, NestJS, Express, Spring Boot, Django, GraphQL",
        "Databases: PostgreSQL, MySQL, MongoDB, Prisma, Firebase, Supabase",
        "Cloud & DevOps: Docker, Vercel, Cloudflare, Azure",
        "Languages: TypeScript, JavaScript, Java, C#, Python, PHP",
      ],
      outro: "The full list is in the skills section on the About page.",
    },
  },
  {
    id: 5,
    icon: "🟣",
    question: "Can you build custom software for businesses?",
    answer: {
      intro:
        "Yes. I've delivered client websites as a freelancer, built point-of-sale and inventory systems from scratch on contract, led small teams on client projects, and I work on cross-platform products as part of the Datalake Creative engineering team.",
    },
  },
  {
    id: 6,
    icon: "🟠",
    question: "How do you approach quality and security?",
    answer: {
      intro:
        "In recent product work I've built security and reliability features such as:",
      points: [
        "Multi-factor authentication (MFA) flows",
        "Database backup and sync with fallback strategies",
        "Versioned snapshots and scheduled jobs for content tooling",
        "Redis caching",
      ],
    },
  },
  {
    id: 7,
    icon: "🟢",
    question: "Do you work with clients outside of Sri Lanka?",
    answer: {
      intro:
        "Yes. I'm based in Sri Lanka and work remotely, currently with the UK-based team at Datalake Creative Ltd, and I've delivered freelance websites for clients in the UAE.",
    },
  },
  {
    id: 8,
    icon: "🔴",
    question: "How can I get in touch with you?",
    answer: {
      intro: `Use the Contact page, or email me directly at ${Site.email}. Whether it's a project idea, a collaboration, or just a chat about tech, I look forward to hearing from you.`,
    },
  },
];

export const HomeContent = {
  hero: {
    status: "Open to freelance projects",
    title: "I build web and mobile products from first sketch to production.",
    subtitle: `${Site.myRole} at ${Site.org}, working remotely from Sri Lanka.`,
    primary: { label: "View my work", href: "#works" },
    secondary: { label: "Get in touch", href: "/contact" },
  },
  proof: {
    label: "Track record",
  },
  // Words for the "I'm a ..." card. Every one is backed by the Works and
  // Experience pages.
  iam: {
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
  },
  // Direct lines. Hrefs come from Site so there is one place to edit them.
  channels: {
    title: "Say hello",
    whatsApp: { label: "WhatsApp", detail: "Chat now" },
    telegram: { label: "Telegram", detail: "Message me" },
    email: { label: "Email", detail: Site.email },
    newTab: "(opens in a new tab)",
  },
  home: {
    works: {
      title: "Selected work",
      subtitle:
        "Products and client sites I have built and shipped. Open any of them to see the details.",
    },
    services: {
      title: "What I can build for you",
      subtitle: "Web, mobile and backend work, handled from design to deployment.",
    },
    process: {
      title: "How a project runs",
      subtitle: "Four steps, and you know where things stand at each one.",
    },
    toolbox: {
      title: "Tools I work with every day",
      subtitle: "The stack behind the products above.",
    },
    faq: {
      title: "Questions, answered",
      subtitle: "The things people usually ask before we start.",
    },
  },
  teams: {
    label: "Built with teams and for clients",
  },
  why: {
    title: "Why people hire me",
    subtitle: "What you get when one engineer owns the whole product.",
    points: [
      {
        icon: "layers",
        title: "One engineer, the whole product",
        body: "Interface, API, database and deployment from one person, so nothing gets lost between handoffs.",
      },
      {
        icon: "smartphone",
        title: "Shipped on every platform",
        body: "Android, iOS, web and admin panels. The work on this page is proof, not a promise.",
      },
      {
        icon: "shield",
        title: "Built to keep running",
        body: "Backups with fallbacks, versioned content snapshots, caching and multi-factor sign-in: the unglamorous parts that keep a product alive.",
      },
      {
        icon: "globe",
        title: "Easy to work with from anywhere",
        body: "Remote by default, currently with a UK-based team. Clear updates and working builds along the way.",
      },
    ],
  },
  process: [
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
  finalCta: {
    title: "Have something you need built?",
    subtitle:
      "Tell me what you are working on. We can talk through scope, timing and the best way to build it.",
    primary: { label: "Start a project", href: "/contact" },
    copyLabel: "Copy email",
    copiedLabel: "Email copied",
  },
  service: {
    title: "Services I Offer",
    subtitle: "Find the services you need from me!",
    label: "Services",
    icon: "🚀",
  },
  works: {
    title: "Featured Works",
    subtitle: "A few projects I'm proud of",
    label: "Works",
    icon: "🔥",
    buttonTitle: "See all my works",
  },
  faq: {
    title: ["Frequently", "Asked", "Questions"],
    label: "FAQ",
    icon: "😇",
    questions,
  },
};
