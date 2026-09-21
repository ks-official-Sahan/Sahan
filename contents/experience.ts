import { ExperienceEntry } from "@/types/experience";

// Highlights are outcome-led and specific on purpose: what the team could do
// because of the work, not a list of what was built. The projects themselves
// live on the works page (`contents/projects.ts`).
export const Experience: ExperienceEntry[] = [
  {
    company: "Datalake Creative Ltd",
    companyUrl: "https://datalakecreative.com",
    role: "Software Engineer",
    period: "2025 — Present",
    type: "full-time",
    location: "United Kingdom (Remote)",
    current: true,
    highlights: [
      "Take products from first commit to the app stores across Android, iOS, web and admin, so real users have them in their hands.",
      "Reliability is the feature: Redis caching, database backup and sync with fallbacks, and multi-factor authentication keep products fast, available and safe.",
      "Give non-technical teams control: AI-assisted content tooling, versioned content snapshots and scheduled jobs let them publish with confidence.",
    ],
  },
  {
    company: "Evision IT PVT Ltd",
    companyUrl: "https://evision-it.com",
    role: "Software Engineer",
    period: "2025",
    type: "contract",
    location: "Sri Lanka",
    highlights: [
      "Turned a finance workflow into a clickable demo, so stakeholders could judge the product by using it, not by reading a spec.",
    ],
  },
  {
    company: "CodyZea PVT Ltd",
    companyUrl:
      "https://web.facebook.com/people/Cody-Zea-Software-Solutions/61569599424974/",
    role: "Software Engineer",
    period: "2024",
    type: "contract",
    location: "Sri Lanka",
    highlights: [
      "Led the team, not just the code: planned client projects and steered them from kickoff to launch.",
      "Ran mentoring programs for new recruits at a startup, so newcomers could contribute to real client work sooner.",
    ],
  },
  {
    company: "ImaginecoreX PVT Ltd",
    role: "Software Engineer",
    period: "2024",
    type: "part-time",
    location: "Sri Lanka",
    highlights: [
      "Combined a part-time role with an internship, building web and mobile apps end to end alongside a team, from a blank repo to a working product.",
    ],
  },
  {
    company: "Quantum Cod PVT Ltd",
    companyUrl: "https://quantumcod.com",
    role: "Software Engineer",
    period: "2023",
    type: "contract",
    location: "Sri Lanka",
    highlights: [
      "Built the systems that run a shop's day, checkout, inventory and reporting, from scratch, plus company websites that look sharp on every screen.",
    ],
  },
  {
    company: "Freelance",
    role: "Full-Stack Developer",
    period: "2023 — Present",
    type: "freelance",
    location: "Remote",
    highlights: [
      "Trusted by clients in the UAE and Sri Lanka for websites built to turn visitors into enquiries and bookings.",
    ],
  },
];
