import { chainPlan } from "./adapters";
import type { AiEnv } from "./env";
import { imageConfigFromEnv } from "./image";
import type { TextPurpose } from "./models";

// Which AI features can run, from the environment alone. A feature is on only
// when its switch is on and a provider for it is configured, so a UI never
// offers something every request would refuse.

/**
 * At least one text provider can answer for the purpose (both when omitted):
 * configured, in AI_PROVIDER_ORDER when one is set, and paid ones only with
 * AI_ALLOW_PAID (./adapters).
 */
export function textAiConfigured(env: AiEnv, purpose?: TextPurpose): boolean {
  if (purpose) return chainPlan(env, purpose).length > 0;
  return chainPlan(env, "blog").length > 0 || chainPlan(env, "chat").length > 0;
}

/** The blog AI assistant: ENABLE_BLOG_AI=true (off by default) and a blog text provider. */
export function blogAiEnabled(env: AiEnv): boolean {
  return env.ENABLE_BLOG_AI && textAiConfigured(env, "blog");
}

/** Blog AI images (featured and inline): blog AI plus at least one image provider. */
export function blogAiImagesEnabled(env: AiEnv): boolean {
  return blogAiEnabled(env) && imageConfigFromEnv(env) !== null;
}

/** The chatbot: ENABLE_CHATBOT (on unless set to false) and a text provider. */
export function chatbotEnabled(env: AiEnv): boolean {
  return env.ENABLE_CHATBOT && textAiConfigured(env, "chat");
}
