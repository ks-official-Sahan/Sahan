import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

import type { AppEnv } from "@/lib/env";
import { log } from "@/lib/log";

import type { ModelPrompt } from "./guard";

// An injectable, ordered provider chain, in the style of lib/email/service.ts
// (docs/plan/admin-cms-adr.md, decision D15: OpenRouter, then Gemini, then
// NVIDIA, paid OpenRouter models off by default). Every provider here is a
// thin adapter: the fallback logic in createAiService() is pure and unit
// tested with fakes, and real network calls only happen through
// realProviders(), which this agent never calls in a test.

export type AiOutcome =
  | { ok: true; text: string }
  | { ok: false; errorClass: string; retryable: boolean; status?: number };

export interface AiProvider {
  readonly name: string;
  generate(prompt: ModelPrompt, options?: { maxTokens?: number }): Promise<AiOutcome>;
}

export interface AiAttempt {
  provider: string;
  ok: boolean;
  errorClass?: string;
  ms: number;
}

export interface AiResult {
  ok: boolean;
  provider: string | null;
  text?: string;
  errorClass?: string;
  attempts: AiAttempt[];
}

export const AI_TIMEOUT_MS = 25_000;

async function withTimeout(promise: Promise<AiOutcome>, ms: number): Promise<AiOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AiOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, errorClass: "timeout", retryable: true }), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export interface AiServiceDeps {
  providers: readonly AiProvider[];
  timeoutMs?: number;
}

/** Tries each provider in order, stopping at the first success or the first non-retryable failure. */
export function createAiService(deps: AiServiceDeps) {
  const timeoutMs = deps.timeoutMs ?? AI_TIMEOUT_MS;

  async function generate(prompt: ModelPrompt, options?: { maxTokens?: number }): Promise<AiResult> {
    if (deps.providers.length === 0) {
      return { ok: false, provider: null, errorClass: "no_provider", attempts: [] };
    }

    const attempts: AiAttempt[] = [];
    for (const provider of deps.providers) {
      const started = Date.now();
      let outcome: AiOutcome;
      try {
        outcome = await withTimeout(provider.generate(prompt, options), timeoutMs);
      } catch {
        outcome = { ok: false, errorClass: "transport", retryable: true };
      }
      const ms = Date.now() - started;

      if (outcome.ok) {
        attempts.push({ provider: provider.name, ok: true, ms });
        return { ok: true, provider: provider.name, text: outcome.text, attempts };
      }
      attempts.push({ provider: provider.name, ok: false, errorClass: outcome.errorClass, ms });
      log.warn("ai provider failed", { provider: provider.name, errorClass: outcome.errorClass });
      if (!outcome.retryable) break;
    }

    return { ok: false, provider: null, errorClass: attempts[attempts.length - 1]?.errorClass, attempts };
  }

  return { generate };
}

// ─── Real providers (never used in tests) ────────────────────────────────────

const FREE_SUFFIX = ":free";

/** OpenRouter, OpenAI-compatible. Refuses a paid model id unless the owner opted in. */
export function openRouterProvider(config: {
  apiKey: string;
  model: string;
  baseUrl?: string;
  allowPaidModels: boolean;
  fetch?: typeof fetch;
}): AiProvider {
  const client = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || "https://openrouter.ai/api/v1",
    fetch: config.fetch,
  });

  return {
    name: "openrouter",
    async generate(prompt, options) {
      if (!config.allowPaidModels && !config.model.endsWith(FREE_SUFFIX)) {
        return { ok: false, errorClass: "paid_model_blocked", retryable: true };
      }
      try {
        const result = await generateText({
          model: client(config.model),
          system: prompt.system,
          prompt: prompt.user,
          maxOutputTokens: options?.maxTokens ?? 1200,
        });
        return { ok: true, text: result.text };
      } catch (error) {
        return { ok: false, errorClass: "provider_error", retryable: true, status: (error as { status?: number })?.status };
      }
    },
  };
}

/** NVIDIA NIM, OpenAI-compatible. */
export function nvidiaProvider(config: { apiKey: string; model: string; fetch?: typeof fetch }): AiProvider {
  const client = createOpenAI({
    apiKey: config.apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
    fetch: config.fetch,
  });

  return {
    name: "nvidia",
    async generate(prompt, options) {
      try {
        const result = await generateText({
          model: client(config.model),
          system: prompt.system,
          prompt: prompt.user,
          maxOutputTokens: options?.maxTokens ?? 1200,
        });
        return { ok: true, text: result.text };
      } catch (error) {
        return { ok: false, errorClass: "provider_error", retryable: true, status: (error as { status?: number })?.status };
      }
    },
  };
}

/** Gemini's own REST API (not OpenAI-compatible), called directly so no extra SDK is added for one provider. */
export function geminiProvider(config: { apiKey: string; model?: string; fetchImpl?: typeof fetch }): AiProvider {
  const model = config.model || "gemini-2.0-flash";
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    name: "gemini",
    async generate(prompt, options) {
      try {
        const response = await fetchImpl(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: prompt.system }] },
              contents: [{ role: "user", parts: [{ text: prompt.user }] }],
              generationConfig: { maxOutputTokens: options?.maxTokens ?? 1200 },
            }),
          }
        );
        if (!response.ok) {
          return { ok: false, errorClass: `http_${response.status}`, retryable: response.status >= 500, status: response.status };
        }
        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
        if (!text) return { ok: false, errorClass: "empty_response", retryable: true };
        return { ok: true, text };
      } catch {
        return { ok: false, errorClass: "transport", retryable: true };
      }
    },
  };
}

/** The chain from decision D15, using whichever keys are configured. Empty when none are set. */
export function realProviders(env: AppEnv, fetchImpl?: typeof fetch): AiProvider[] {
  const providers: AiProvider[] = [];
  const openRouterModel = env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
  // Two keys are two quota pools on the same provider: both go in the chain
  // (named distinctly for the audit trail), so a rate-limited first key falls
  // through to the second before the chain moves on to Gemini.
  if (env.OPENROUTER_API_KEY) {
    providers.push(
      openRouterProvider({
        apiKey: env.OPENROUTER_API_KEY,
        model: openRouterModel,
        baseUrl: env.OPENROUTER_BASE_URL,
        allowPaidModels: env.OPENROUTER_ALLOW_PAID_MODELS,
        fetch: fetchImpl,
      })
    );
  }
  if (env.OPENROUTER_API_KEY_2) {
    providers.push(
      openRouterProvider({
        apiKey: env.OPENROUTER_API_KEY_2,
        model: openRouterModel,
        baseUrl: env.OPENROUTER_BASE_URL,
        allowPaidModels: env.OPENROUTER_ALLOW_PAID_MODELS,
        fetch: fetchImpl,
      })
    );
  }
  if (env.GEMINI_API_KEY) providers.push(geminiProvider({ apiKey: env.GEMINI_API_KEY, fetchImpl }));
  if (env.NVIDIA_API_KEY) {
    providers.push(nvidiaProvider({ apiKey: env.NVIDIA_API_KEY, model: "meta/llama-3.1-8b-instruct", fetch: fetchImpl }));
  }
  return providers;
}
