import type { ChatSessionSummary } from "./session-summaries";
import type { ChatTurn } from "./types";

// The storage contract behind the chatbot. The package never touches a
// database: the host app implements ChatStore once (Prisma, Drizzle, a KV
// store) and its route calls it around runChat().

export interface ChatSessionInput {
  /** Client-generated opaque id; a grouping key, not a secret. */
  sessionId: string;
  ipHash?: string;
  userAgent?: string;
  pagePath?: string;
}

export interface ChatMessageInput {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  tokens?: number;
  latencyMs?: number;
}

export interface ChatStore {
  /** Creates the session on first use; a no-op for an existing one. */
  upsertSession(input: ChatSessionInput): Promise<unknown>;
  /** Stores one turn and bumps the session's message count. */
  addMessage(input: ChatMessageInput): Promise<unknown>;
  /** The last `limit` turns, oldest first. */
  getRecentMessages(sessionId: string, limit: number): Promise<ChatTurn[]>;
  /** Marks the session as having produced a contact inquiry. */
  linkInquiry(sessionId: string, inquiryId: string): Promise<unknown>;
  /** One page of the admin conversations list, newest first, no message bodies. */
  listSessionSummaries(options: { limit: number; offset: number }): Promise<ChatSessionSummary[]>;
}
