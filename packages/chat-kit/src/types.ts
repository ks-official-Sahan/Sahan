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
}

/** One earlier turn of the conversation, oldest first. */
export interface ChatTurn {
  role: string;
  content: string;
}
