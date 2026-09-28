import "server-only";

import type { AiLogger } from "@sahan-sac/ai-core/log";
import { createAiService, type AiHealth, type AiProvider } from "@sahan-sac/ai-core/providers";

import { filterModelOutput, guardUserMessage } from "./guard";
import { knowledgeHosts } from "./knowledge";
import { buildChatPrompt } from "./prompts";
import type { ChatbotConfig, ChatSite, ChatTurn } from "./types";

// One chat turn, minus everything that belongs to the host: HTTP, origin and
// rate-limit checks, cookies, settings and storage stay in the app's route.
// This part guards the visitor's message, builds the prompt, runs the
// provider chain on a visitor-facing budget and filters the reply.

/** A visitor waits on this: fail over fast and give up well before a proxy timeout. */
export const CHAT_BUDGETS = { timeoutMs: 12_000, deadlineMs: 20_000, hedgeAfterMs: 5_000, maxTokens: 500 } as const;

const EMPTY_REPLY = "I apologize, but I was unable to generate a response.";

export interface RunChatInput {
  message: string;
  history?: readonly ChatTurn[];
  knowledge?: string | null;
  config: ChatbotConfig;
  site: ChatSite;
  /** The site's own hostname; its subdomains are allowed in links too. */
  siteHostname: string;
  /** Other hosts a reply may link to (e.g. "wa.me"), on top of the site and the hosts in the knowledge. */
  extraHosts?: readonly string[];
}

export interface RunChatDeps {
  providers: readonly AiProvider[];
  health?: AiHealth;
  logger?: AiLogger;
  now?: () => number;
}

export type RunChatResult =
  | { ok: true; text: string; provider: string; latencyMs: number; tokens: number }
  | { ok: false; errorClass: string };

export async function runChat(input: RunChatInput, deps: RunChatDeps): Promise<RunChatResult> {
  const knowledge = input.knowledge ?? "";
  const prompt = buildChatPrompt({
    config: input.config,
    site: input.site,
    knowledge,
    userMessage: guardUserMessage(input.message),
    history: input.history,
  });

  const now = deps.now ?? Date.now;
  const service = createAiService({
    providers: deps.providers,
    timeoutMs: CHAT_BUDGETS.timeoutMs,
    deadlineMs: CHAT_BUDGETS.deadlineMs,
    hedgeAfterMs: CHAT_BUDGETS.hedgeAfterMs,
    health: deps.health,
    logger: deps.logger,
    now,
  });

  const started = now();
  const result = await service.generate(prompt, { maxTokens: CHAT_BUDGETS.maxTokens });
  const latencyMs = now() - started;
  if (!result.ok) return { ok: false, errorClass: result.errorClass ?? "unknown" };

  // Links may point only where the owner's own content already points
  // (project and profile URLs in the knowledge), never to a host the model invented.
  const allowedHosts = [...new Set([input.siteHostname, ...(input.extraHosts ?? []), ...knowledgeHosts(knowledge)])];
  const text = filterModelOutput(result.text || EMPTY_REPLY, {
    siteHostname: input.siteHostname,
    allowedHosts,
    siteEmail: input.site.email,
  });

  return {
    ok: true,
    text,
    provider: result.provider ?? "unknown",
    latencyMs,
    tokens: Math.ceil((result.text || "").length / 4), // Rough estimate
  };
}
