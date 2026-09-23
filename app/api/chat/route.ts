import { createHash, createHmac } from "node:crypto";
import { headers } from "next/headers";
import { after, NextRequest, NextResponse } from "next/server";

import { createAiService, realProviders, sharedAiHealth } from "@/lib/ai/providers";
import { limit } from "@/lib/cache/ratelimit";
import { filterModelOutput, guardUserMessage } from "@/lib/chatbot/guard";
import { getKnowledge } from "@/lib/chatbot/knowledge";
import { buildChatPrompt } from "@/lib/chatbot/prompts";
import { addMessage, getSessionMessages, upsertSession } from "@/lib/chatbot/session";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { clientIp, UNKNOWN_IP } from "@/lib/security/ip";
import { isAllowedOrigin } from "@/lib/security/origin";
import type { ChatbotConfig } from "@/lib/settings/schema";
import { getPublicSettings } from "@/lib/settings/service";
import { Site } from "@/config/site";

function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

interface ChatRequest {
  sessionId: string;
  message: string;
}

const MAX_MESSAGE_LENGTH = 1000;

export async function POST(request: NextRequest) {
  const env = getEnv();
  const h = await headers();

  // Content-Type check
  const contentType = h.get("content-type");
  if (!contentType?.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }

  // Body size limit (~8 KB)
  const bodyText = await request.text();
  if (bodyText.length > 8 * 1024) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  // Origin check
  const origin = h.get("origin");
  if (!isAllowedOrigin(origin, { hosts: [h.get("host")], siteUrl: env.SITE_URL })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = clientIp(h);
  const knownIp = ip === UNKNOWN_IP ? null : ip;
  // Stored with the chat session only when a secret keys the hash.
  const ipHash = knownIp && env.INTERNAL_SIGNING_SECRET ? hashIp(knownIp, env.INTERNAL_SIGNING_SECRET) : undefined;

  // Per-IP limit (20 per 10 minutes). Same R22 rule as sign-in: without a
  // resolvable IP every visitor would share one bucket and one caller could
  // silence the chat for everyone, so only the per-session limit applies then.
  if (knownIp) {
    const ipLimit = await limit("chat:ip", createHash("sha256").update(knownIp).digest("hex").slice(0, 32));
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(ipLimit.resetSeconds) } }
      );
    }
  }

  // Parse request
  let data: unknown;
  try {
    data = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const chatReq = data as ChatRequest;
  if (!chatReq.sessionId || !chatReq.message) {
    return NextResponse.json({ error: "Missing sessionId or message" }, { status: 400 });
  }

  // Validate message length
  if (chatReq.message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message exceeds ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 }
    );
  }

  // Rate limit by session (per minute, 6 messages)
  const sessionLimit = await limit("chat:session", chatReq.sessionId);
  if (!sessionLimit.ok) {
    return NextResponse.json(
      { error: "Too many messages in this session" },
      { status: 429, headers: { "Retry-After": String(sessionLimit.resetSeconds) } }
    );
  }

  const t0 = Date.now();
  try {
    // Check if chatbot is enabled
    const settings = await getPublicSettings();
    const features = (settings.features as any) || { chatbotEnabled: true };
    if (!features.chatbotEnabled) {
      return NextResponse.json({ error: "Chatbot is not available" }, { status: 503 });
    }

    const chatbotConfig: ChatbotConfig = ((settings["chatbot.config"] as any) || {
      enabled: true,
      tone: "professional",
      greeting: "Hi! How can I help?",
      trainingDataVersion: 0,
    }) as ChatbotConfig;

    if (!chatbotConfig.enabled) {
      return NextResponse.json({ error: "Chatbot is disabled" }, { status: 503 });
    }

    // Reads run together; history is taken before this turn is stored.
    const [history, knowledge] = await Promise.all([
      getSessionMessages(chatReq.sessionId, 10),
      getKnowledge(),
      upsertSession({ sessionId: chatReq.sessionId, ipHash, userAgent: h.get("user-agent") || undefined }),
    ]);
    const storedUserMessage = addMessage({ sessionId: chatReq.sessionId, role: "user", content: chatReq.message }).catch((error) =>
      log.warn("Failed to store chat message", { error: String(error) })
    );

    const prompt = buildChatPrompt({
      config: chatbotConfig,
      knowledge: knowledge || "",
      userMessage: guardUserMessage(chatReq.message),
      history,
    });

    // A visitor waits on this: fail over fast and give up well before a proxy timeout.
    const aiService = createAiService({
      providers: realProviders(env),
      timeoutMs: 12_000,
      deadlineMs: 20_000,
      hedgeAfterMs: 5_000,
      health: sharedAiHealth,
    });

    const started = Date.now();
    const result = await aiService.generate(prompt, { maxTokens: 500 });
    const latencyMs = Date.now() - started;

    if (!result.ok) {
      log.warn("AI service failed for chat", { error: result.errorClass });
      return NextResponse.json(
        { error: "Failed to generate response" },
        { status: 503 }
      );
    }

    // Filter output (pure function with explicit allowed hosts)
    const responseText = result.text || "I apologize, but I was unable to generate a response.";
    const siteHostname = env.SITE_URL ? new URL(env.SITE_URL).hostname : "example.com";
    // Links may point only where the owner's own content already points
    // (project and profile URLs in the knowledge), never to a host the model invented.
    const knowledgeHosts = [...(knowledge ?? "").matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((match) => match[1].toLowerCase());
    const filteredResponse = filterModelOutput(responseText, {
      siteHostname,
      allowedHosts: [...new Set([siteHostname, "wa.me", "t.me", ...knowledgeHosts])],
      siteEmail: Site.email,
    });

    // The visitor gets the reply now; the transcript is written after the response.
    after(async () => {
      try {
        await storedUserMessage;
        await addMessage({
          sessionId: chatReq.sessionId,
          role: "assistant",
          content: filteredResponse,
          tokens: Math.ceil((result.text || "").length / 4), // Rough estimate
          latencyMs,
        });
      } catch (error) {
        log.warn("Failed to store chat transcript", { error: String(error) });
      }
    });

    // Phase timings for monitoring (no content, no identifiers).
    const serverTiming = `prep;dur=${started - t0}, ai;dur=${latencyMs};desc="${result.provider}", total;dur=${Date.now() - t0}`;
    return NextResponse.json(
      { response: filteredResponse, sessionId: chatReq.sessionId },
      { headers: { "Server-Timing": serverTiming, "Cache-Control": "no-store" } }
    );
  } catch (error) {
    log.error("Chat API error", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
