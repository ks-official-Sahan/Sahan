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
        "Real estate: brand and property-listing websites",
        "Finance and productivity: Meto Finance and Hatchy",
        "Reference and language tools: the Wizzie Words dictionary",
        "Hospitality: a booking-focused villa website",
        "Retail: a point-of-sale system",
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
        "Yes. I've delivered client websites as a freelancer, built a point-of-sale system during a contract engagement, and I work on commercial cross-platform products as part of the Datalake Creative engineering team.",
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
  welcome: {
    title: "welcome to my space",
    subtitle:
      "It's very nice to have you here! Feel free to explore around and get to know me.",
    label: "Hello",
    icon: "👋",
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
