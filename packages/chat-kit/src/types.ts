// Inputs the chatbot needs from the host app. The app owns where they come
// from (a settings table, a config file); the package only reads them.

export const CHAT_TONES = ["professional", "friendly", "casual"] as const;
export type ChatTone = (typeof CHAT_TONES)[number];

/** The part of the admin-editable chatbot settings that shapes a reply. */
export interface ChatbotConfig {
  tone: ChatTone;
  greeting?: string;
}

/** Who the assistant speaks for: the site owner's public identity. */
export interface ChatSite {
  /** Short name visitors use, e.g. "Sahan". */
  author: string;
  authorFullName: string;
  role: string;
  /** Current position, e.g. "Software Engineer at Example Ltd". */
  company: string;
  location: string;
  tagline: string;
  email: string;
  phoneDisplay: string;
  gitHubUrl: string;
  siteUrl: string;
  description: string;
  /** What the assistant calls the site, e.g. "portfolio". Default "site". */
  kind?: string;
  /** What visitors may ask about, e.g. "their portfolio, work, projects, skills, experience". Default "their site and work". */
  scope?: string;
  /** How the assistant should format a site link, e.g. "[Project Name](/works) when referencing portfolio content". */
  linkExample?: string;
  /** Standing guidance from the owner (voice, facts, do and don't), appended after the fixed rules. Empty adds nothing. */
  guidance?: string;
}

/** One earlier turn of the conversation, oldest first. */
export interface ChatTurn {
  role: string;
  content: string;
}
