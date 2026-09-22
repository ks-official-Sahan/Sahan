import { createHmac } from "crypto";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";

import { limit } from "@/lib/cache/ratelimit";
import { getEnv } from "@/lib/env";
import { clientIp } from "@/lib/security/ip";
import { isAllowedOrigin } from "@/lib/security/origin";
import { log } from "@/lib/log";
import { getPublicSettings } from "@/lib/settings/service";
import { getKnowledge } from "@/lib/chatbot/knowledge";
import { guardUserMessage, filterModelOutput } from "@/lib/chatbot/guard";
import { buildChatPrompt } from "@/lib/chatbot/prompts";
import { upsertSession, addMessage, getSessionMessages, linkInquiry } from "@/lib/chatbot/session";
import { createAiService } from "@/lib/ai/providers";
import { realProviders } from "@/lib/ai/providers";
import { createInquiry } from "@/lib/inquiries/service";
import type { ChatbotConfig } from "@/lib/settings/schema";
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

  // Get client IP (hash only if secret exists)
  const ip = clientIp(h);
  const ipHash = ip && env.INTERNAL_SIGNING_SECRET ? hashIp(ip, env.INTERNAL_SIGNING_SECRET) : undefined;

  // Rate limit by IP (per 10 min, 20 messages)
  const ipLimit = await limit("chat:ip", ipHash || "unknown");
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(ipLimit.resetSeconds) } }
    );
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

    // Upsert session
    await upsertSession({
      sessionId: chatReq.sessionId,
      ipHash,
      userAgent: h.get("user-agent") || undefined,
      pagePath: chatReq.message.match(/^page:/) ? chatReq.message : undefined,
    });

    // Add user message
    await addMessage({
      sessionId: chatReq.sessionId,
      role: "user",
      content: chatReq.message,
    });

    // Get conversation history (last 10 messages for context)
    const history = await getSessionMessages(chatReq.sessionId, 10);

    // Get knowledge
    const knowledge = await getKnowledge();

    // Build prompt
    const guardedMessage = guardUserMessage(chatReq.message);
    const prompt = buildChatPrompt({
      config: chatbotConfig,
      knowledge: knowledge || "",
      userMessage: guardedMessage,
    });

    // Generate response using the AI service
    const aiService = createAiService({
      providers: realProviders(env),
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
    const filteredResponse = filterModelOutput(responseText, {
      siteHostname,
      allowedHosts: [siteHostname, "wa.me", "t.me"],
      siteEmail: Site.email,
    });

    // Add assistant message
    await addMessage({
      sessionId: chatReq.sessionId,
      role: "assistant",
      content: filteredResponse,
      tokens: Math.ceil((result.text || "").length / 4), // Rough estimate
      latencyMs,
    });

    // Check for lead capture intent (simplified: if message mentions contact or help)
    const contactIntent =
      chatReq.message.toLowerCase().includes("contact") ||
      chatReq.message.toLowerCase().includes("help") ||
      chatReq.message.toLowerCase().includes("email") ||
      chatReq.message.toLowerCase().includes("reach");

    if (contactIntent && chatReq.message.length > 20) {
      // Create inquiry from the chat
      try {
        const inquiry = await createInquiry({
          name: "Chat Visitor",
          email: "",
          message: chatReq.message,
          source: "chatbot",
          ipHash,
          userAgent: h.get("user-agent") || undefined,
          spamScore: 0,
        });
        await linkInquiry(chatReq.sessionId, inquiry.id);
      } catch (error) {
        log.warn("Failed to create inquiry from chat", { error: String(error) });
      }
    }

    return NextResponse.json({
      response: filteredResponse,
      sessionId: chatReq.sessionId,
    });
  } catch (error) {
    log.error("Chat API error", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
