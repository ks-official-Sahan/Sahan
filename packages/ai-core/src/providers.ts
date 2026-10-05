import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

import type { ModelPrompt } from "./guard";
import { consoleAiLogger, type AiLogger } from "./log";
import { DEFAULT_TEXT_MODELS, thinkingConfigFor } from "./models";
import { getVertexAccessToken } from "./vertex";

// Two patterns, kept apart on purpose:
// - Adapter: every provider (Gemini, OpenRouter, NVIDIA, Vertex, any
//   OpenAI-compatible API, Anthropic) is wrapped as an AiProvider with one
//   generate() that answers ok or a classified failure, never a throw.
// - Chain of responsibility: createAiService() hands the prompt to the first
//   provider and passes it down the chain on any retryable failure (quota,
//   timeout, bad key, retired model, invalid output) until one answers, with
//   cooldowns, hedging and a whole-chain deadline on top.
// Which providers form a chain, in what order, comes from ./adapters (the
// registry and its env guards). The chain logic here is pure and unit tested
// with fakes; real network calls only happen through the adapters.

export type AiOutcome =
  | { ok: true; text: string }
  | { ok: false; errorClass: string; retryable: boolean; status?: number };

export interface AiGenerateOptions {
  maxTokens?: number;
  /** Aborted when the attempt times out, so a slow provider stops consuming a socket. */
  signal?: AbortSignal;
  /**
   * JSON output. `true` asks for JSON (Gemini/Vertex responseMimeType); an
   * object also passes a response schema, which Gemini/Vertex enforce while
   * decoding, so the reply is always syntactically valid, correctly escaped
   * JSON of that shape. Providers without the feature ignore it.
   */
  jsonMode?: JsonMode;
}

export type JsonMode = boolean | { schema: Record<string, unknown> };

/** generationConfig fields for Gemini/Vertex JSON output. */
function jsonConfig(jsonMode: JsonMode | undefined): Record<string, unknown> {
  if (!jsonMode) return {};
  return typeof jsonMode === "object" ? { responseMimeType: "application/json", responseSchema: jsonMode.schema } : { responseMimeType: "application/json" };
}

export interface AiProvider {
  readonly name: string;
  /** Paid or otherwise costly: tried only after every other provider, whatever its speed or health. */
  readonly lastResort?: boolean;
  /**
   * Position in an order the operator chose (AI_PROVIDER_ORDER): lower goes
   * first, and speed no longer reorders it. A cooling provider still drops
   * behind the healthy ones.
   */
  readonly priority?: number;
  generate(prompt: ModelPrompt, options?: AiGenerateOptions): Promise<AiOutcome>;
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
  /** The last reply `accept` turned down, kept so a caller can ask a model to repair it. */
  rejected?: { provider: string; text: string; reason: string };
}

export const AI_TIMEOUT_MS = 25_000;
/** A provider that timed out or was rate limited goes to the back of the line for this long. */
export const AI_COOLDOWN_MS = 60_000;

async function attempt(
  provider: AiProvider,
  prompt: ModelPrompt,
  maxTokens: number | undefined,
  ms: number,
  cancel: AbortSignal,
  jsonMode?: JsonMode
): Promise<AiOutcome> {
  const controller = new AbortController();
  const onCancel = () => controller.abort();
  cancel.addEventListener("abort", onCancel, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AiOutcome>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, errorClass: "timeout", retryable: true });
    }, ms);
  });
  try {
    return await Promise.race([provider.generate(prompt, { maxTokens, signal: controller.signal, jsonMode }), timeout]);
  } catch {
    return { ok: false, errorClass: "transport", retryable: true };
  } finally {
    clearTimeout(timer);
    cancel.removeEventListener("abort", onCancel);
  }
}

/** What the chain has learned about each provider: when it may lead again, and how fast it answers. */
export interface AiHealth {
  cooldownUntil: Map<string, number>;
  latencyMs: Map<string, number>;
}

export const createAiHealth = (): AiHealth => ({ cooldownUntil: new Map(), latencyMs: new Map() });

/** One per server instance, for request handlers; tests and scripts get a fresh one by default. */
export const sharedAiHealth: AiHealth = ((globalThis as unknown as { sahanAiHealth?: AiHealth }).sahanAiHealth ??= createAiHealth());

/** Quota and slowness pass quickly; a wrong key or a retired model needs an operator, so it cools longer. */
function cooldownFor(outcome: AiOutcome): number {
  if (outcome.ok) return 0;
  if (outcome.errorClass === "timeout" || outcome.status === 429) return AI_COOLDOWN_MS;
  if (outcome.status === 401 || outcome.status === 403 || outcome.status === 404) return AI_COOLDOWN_MS * 10;
  return 0;
}

export interface AiServiceDeps {
  providers: readonly AiProvider[];
  /** Per-provider attempt budget. */
  timeoutMs?: number;
  /** Whole-chain budget; the remaining time caps each later attempt. */
  deadlineMs?: number;
  /**
   * Hedged requests: when the running attempt has not answered after this
   * long, the next provider starts too and the first success wins (the
   * others are aborted). Off by default, so attempts run one at a time.
   */
  hedgeAfterMs?: number;
  health?: AiHealth;
  now?: () => number;
  /** Where provider failures are reported; defaults to one JSON line on stderr. */
  logger?: AiLogger;
}

export type AiAttemptStatus = {
  provider: string;
  stage: "start" | "failure" | "fallback" | "success";
  errorClass?: string;
  fallbackTo?: string;
};

export const HEDGE = Symbol("hedge");

/**
 * Tries providers until one succeeds, a non-retryable failure stops the chain,
 * or the deadline passes. Healthy providers lead, fastest observed first;
 * cooling ones go last instead of being dropped, so a request always gets a
 * real attempt even when every provider is cooling.
 */
export function createAiService(deps: AiServiceDeps) {
  const timeoutMs = deps.timeoutMs ?? AI_TIMEOUT_MS;
  const now = deps.now ?? Date.now;
  const health = deps.health ?? createAiHealth();
  const logger = deps.logger ?? consoleAiLogger;

  function rank(at: number): AiProvider[] {
    const cooling = (p: AiProvider) => Number((health.cooldownUntil.get(p.name) ?? 0) > at);
    const speed = (p: AiProvider) => health.latencyMs.get(p.name) ?? Number.POSITIVE_INFINITY;
    const costly = (p: AiProvider) => Number(Boolean(p.lastResort));
    const chosen = (a: AiProvider, b: AiProvider) =>
      a.priority !== undefined && b.priority !== undefined ? a.priority - b.priority : speed(a) - speed(b);
    // Array.prototype.sort is stable, so unmeasured providers keep the configured order.
    return [...deps.providers].sort((a, b) => costly(a) - costly(b) || cooling(a) - cooling(b) || chosen(a, b));
  }

  async function generate(
    prompt: ModelPrompt,
    options?: {
      maxTokens?: number;
      jsonMode?: JsonMode;
      onAttempt?: (status: AiAttemptStatus) => void;
      /**
       * Output check run on each reply before it counts as a success: return
       * null to accept, or a reason to treat the reply as that provider's
       * failure. With hedging on, this is what stops a fast but broken reply
       * (malformed JSON from a weak model) from beating a slower valid one.
       */
      accept?: (text: string) => string | null;
      /**
       * The caller gave up (an admin cancelled, a client disconnected): every
       * running attempt is aborted, no further provider starts, and the result
       * is `errorClass: "aborted"`. An aborted attempt is not the provider's
       * fault, so it is neither logged nor cooled down.
       */
      signal?: AbortSignal;
    }
  ): Promise<AiResult> {
    if (deps.providers.length === 0) {
      return { ok: false, provider: null, errorClass: "no_provider", attempts: [] };
    }
    const external = options?.signal;
    if (external?.aborted) return { ok: false, provider: null, errorClass: "aborted", attempts: [] };

    const startedAll = now();
    const ordered = rank(startedAll);
    const attempts: AiAttempt[] = [];
    const cancelLosers = new AbortController();
    const running = new Set<Promise<void>>();
    let next = 0;
    let stopped = false;
    let result: AiResult | null = null;
    let rejected: AiResult["rejected"];
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<void>((resolve) => {
      onAbort = () => {
        stopped = true;
        cancelLosers.abort();
        resolve();
      };
      external?.addEventListener("abort", onAbort, { once: true });
    });

    const launch = (): boolean => {
      if (result || stopped || next >= ordered.length) return false;
      const remaining = deps.deadlineMs === undefined ? timeoutMs : deps.deadlineMs - (now() - startedAll);
      if (remaining <= 250) return false;
      const provider = ordered[next++];
      options?.onAttempt?.({ provider: provider.name, stage: "start" });
      const started = now();
      const run = attempt(provider, prompt, options?.maxTokens, Math.min(timeoutMs, remaining), cancelLosers.signal, options?.jsonMode).then((raw) => {
        if (result || external?.aborted) return; // Lost the race or the caller left; not the provider's fault.
        const ms = now() - started;
        let outcome = raw;
        if (outcome.ok && options?.accept) {
          const reason = options.accept(outcome.text);
          if (reason) {
            rejected = { provider: provider.name, text: outcome.text, reason };
            outcome = { ok: false, errorClass: "invalid_output", retryable: true };
          }
        }
        if (outcome.ok) {
          health.cooldownUntil.delete(provider.name);
          const previous = health.latencyMs.get(provider.name);
          health.latencyMs.set(provider.name, previous === undefined ? ms : Math.round(previous * 0.7 + ms * 0.3));
          attempts.push({ provider: provider.name, ok: true, ms });
          result = { ok: true, provider: provider.name, text: outcome.text, attempts };
          options?.onAttempt?.({ provider: provider.name, stage: "success" });
          cancelLosers.abort();
          return;
        }
        attempts.push({ provider: provider.name, ok: false, errorClass: outcome.errorClass, ms });
        const fallbackTo = next < ordered.length ? ordered[next].name : undefined;
        options?.onAttempt?.({
          provider: provider.name,
          stage: fallbackTo ? "fallback" : "failure",
          errorClass: outcome.errorClass,
          fallbackTo,
        });
        const cooldown = cooldownFor(outcome);
        if (cooldown) health.cooldownUntil.set(provider.name, now() + cooldown);
        logger.warn("ai provider failed", {
          provider: provider.name,
          errorClass: outcome.errorClass,
          ms,
          ...(outcome.errorClass === "invalid_output" && rejected ? { reason: rejected.reason.slice(0, 160) } : {}),
        });
        if (!outcome.retryable) stopped = true;
      });
      const tracked: Promise<void> = run.finally(() => running.delete(tracked));
      running.add(tracked);
      return true;
    };

    try {
      while (!result && !external?.aborted) {
        if (running.size === 0 && !launch()) break;
        let timer: ReturnType<typeof setTimeout> | undefined;
        // `aborted` returns at once, even from a provider that ignores its signal.
        const racers: Promise<unknown>[] = [...running, aborted];
        if (deps.hedgeAfterMs !== undefined && next < ordered.length) {
          racers.push(new Promise((resolve) => (timer = setTimeout(() => resolve(HEDGE), deps.hedgeAfterMs))));
        }
        const first = await Promise.race(racers);
        clearTimeout(timer);
        if (first === HEDGE) launch();
      }
    } finally {
      if (onAbort) external?.removeEventListener("abort", onAbort);
    }

    if (result) return result;
    if (external?.aborted) return { ok: false, provider: null, errorClass: "aborted", attempts, rejected };
    return { ok: false, provider: null, errorClass: attempts[attempts.length - 1]?.errorClass ?? "deadline", attempts, rejected };
  }

  return { generate };
}

/**
 * Every HTTP failure falls through to the next provider: a 401 (bad key), 404
 * (retired model) or 429 (quota) is specific to this provider, and even a 400
 * may be a model limit another provider does not share.
 */
function httpOutcome(status: number): AiOutcome {
  return { ok: false, errorClass: `http_${status}`, retryable: true, status };
}

// ─── Real providers (never used in tests) ────────────────────────────────────

const FREE_SUFFIX = ":free";

/** OpenRouter, OpenAI-compatible. Refuses a paid model id unless the owner opted in. */
export function openRouterProvider(config: {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  allowPaidModels: boolean;
  fetch?: typeof fetch;
  name?: string;
}): AiProvider {
  const model = config.model || DEFAULT_TEXT_MODELS.blog.openrouter;
  const client = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || "https://openrouter.ai/api/v1",
    fetch: config.fetch,
  });

  return {
    name: config.name ?? "openrouter",
    async generate(prompt, options) {
      if (!config.allowPaidModels && !model.endsWith(FREE_SUFFIX)) {
        return { ok: false, errorClass: "paid_model_blocked", retryable: true };
      }
      return sdkGenerate(client.chat(model), prompt, options);
    },
  };
}

/** The chain does the retrying: the SDK's own retries (2 by default, with backoff) would multiply every slow provider's latency. */
async function sdkGenerate(model: Parameters<typeof generateText>[0]["model"], prompt: ModelPrompt, options?: AiGenerateOptions): Promise<AiOutcome> {
  try {
    const result = await generateText({
      model,
      system: prompt.system,
      prompt: prompt.user,
      maxOutputTokens: options?.maxTokens ?? 1200,
      maxRetries: 0,
      abortSignal: options?.signal,
    });
    if (!result.text) return { ok: false, errorClass: "empty_response", retryable: true };
    if (result.finishReason === "length") return { ok: false, errorClass: "truncated", retryable: true };
    return { ok: true, text: result.text };
  } catch (error) {
    const status = (error as { statusCode?: number; status?: number })?.statusCode ?? (error as { status?: number })?.status;
    if (status) return httpOutcome(status);
    return { ok: false, errorClass: options?.signal?.aborted ? "timeout" : "provider_error", retryable: true };
  }
}

/**
 * Any OpenAI-compatible chat completions API: OpenAI itself, DeepSeek, xAI
 * (Grok), Perplexity, a self-hosted gateway (vLLM, Ollama, LiteLLM).
 */
export function openAiCompatibleProvider(config: {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}): AiProvider {
  const client = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl, headers: config.headers, fetch: config.fetch });
  return {
    name: config.name,
    generate: (prompt, options) => sdkGenerate(client.chat(config.model), prompt, options),
  };
}

/** NVIDIA NIM, OpenAI-compatible. */
export function nvidiaProvider(config: { apiKey: string; model?: string; fetch?: typeof fetch }): AiProvider {
  return openAiCompatibleProvider({
    name: "nvidia",
    apiKey: config.apiKey,
    baseUrl: "https://integrate.api.nvidia.com/v1",
    model: config.model || DEFAULT_TEXT_MODELS.blog.nvidia,
    fetch: config.fetch,
  });
}

type AnthropicResponse = { content?: Array<{ type?: string; text?: string }>; stop_reason?: string | null };

/** Text of an Anthropic Messages reply; a reply stopped at the token cap is "truncated", a refusal "refused". */
export function anthropicOutcome(data: unknown): AiOutcome {
  const reply = data as AnthropicResponse;
  if (reply.stop_reason === "max_tokens") return { ok: false, errorClass: "truncated", retryable: true };
  if (reply.stop_reason === "refusal") return { ok: false, errorClass: "refused", retryable: true };
  const text = reply.content?.filter((block) => block.type === "text").map((block) => block.text ?? "").join("") ?? "";
  if (!text) return { ok: false, errorClass: "empty_response", retryable: true };
  return { ok: true, text };
}

/** Anthropic's Messages API over plain REST (no extra SDK for one provider). */
export function anthropicProvider(config: {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): AiProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const base = (config.baseUrl || "https://api.anthropic.com").replace(/\/+$/, "");
  return {
    name: "anthropic",
    async generate(prompt, options) {
      try {
        const system = options?.jsonMode ? `${prompt.system}\n\nReply with one JSON value only, no prose and no code fences.` : prompt.system;
        const response = await fetchImpl(`${base}/v1/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
          signal: options?.signal,
          body: JSON.stringify({
            model: config.model,
            max_tokens: options?.maxTokens ?? 1800,
            system,
            messages: [{ role: "user", content: prompt.user }],
          }),
        });
        if (!response.ok) return httpOutcome(response.status);
        return anthropicOutcome(await response.json());
      } catch {
        return { ok: false, errorClass: options?.signal?.aborted ? "timeout" : "transport", retryable: true };
      }
    },
  };
}

type GeminiResponse = { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };

/** Text of a Gemini/Vertex generateContent reply; a reply stopped at the token cap is "truncated", not a success. */
export function geminiOutcome(data: unknown): AiOutcome {
  const candidate = (data as GeminiResponse).candidates?.[0];
  const text = candidate?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("") ?? "";
  if (candidate?.finishReason === "MAX_TOKENS") return { ok: false, errorClass: "truncated", retryable: true };
  if (!text) return { ok: false, errorClass: "empty_response", retryable: true };
  return { ok: true, text };
}

/** Gemini's own REST API (not OpenAI-compatible), called directly so no extra SDK is added for one provider. */
export function geminiProvider(config: { apiKey: string; model?: string; fetchImpl?: typeof fetch }): AiProvider {
  const model = config.model || DEFAULT_TEXT_MODELS.blog.gemini;
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    name: "gemini",
    async generate(prompt, options) {
      try {
        const maxOutputTokens = options?.maxTokens ?? 2400;
        const generationConfig: Record<string, unknown> = {
          maxOutputTokens,
          thinkingConfig: thinkingConfigFor(model, maxOutputTokens),
          ...jsonConfig(options?.jsonMode),
        };
        let response = await fetchImpl(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            // Header, not ?key=: query strings end up in proxy and access logs.
            headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey },
            signal: options?.signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: prompt.system }] },
              contents: [{ role: "user", parts: [{ text: prompt.user }] }],
              generationConfig,
            }),
          }
        );
        if (response.status === 503 && !options?.signal?.aborted) {
          // 503 is a temporary capacity spike on Google AI Studio; retry once after 500ms
          await new Promise((r) => setTimeout(r, 500));
          if (!options?.signal?.aborted) {
            response = await fetchImpl(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
              {
                method: "POST",
                headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey },
                signal: options?.signal,
                body: JSON.stringify({
                  systemInstruction: { parts: [{ text: prompt.system }] },
                  contents: [{ role: "user", parts: [{ text: prompt.user }] }],
                  generationConfig,
                }),
              }
            );
          }
        }
        if (!response.ok) return httpOutcome(response.status);
        return geminiOutcome(await response.json());
      } catch {
        return { ok: false, errorClass: options?.signal?.aborted ? "timeout" : "transport", retryable: true };
      }
    },
  };
}

/** Google Vertex AI's Gemini endpoint, authenticated with a service-account JWT
 * (lib/ai/vertex.ts) instead of an API key. Last resort in the chain: it is the
 * slowest to authenticate (a token exchange before every cold call) and the
 * most involved to configure correctly, so faster, simpler providers go first. */
export function vertexProvider(config: {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
  project: string;
  location?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): AiProvider {
  const model = config.model || DEFAULT_TEXT_MODELS.blog.vertex;
  // Gemini 3.x is served from the global endpoint only.
  const location = config.location ?? (/^gemini-[3-9]/.test(model) ? "global" : "us-central1");
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    name: "vertex",
    lastResort: true,
    async generate(prompt, options) {
      try {
        const accessToken = await getVertexAccessToken(
          { clientEmail: config.clientEmail, privateKey: config.privateKey, tokenUri: config.tokenUri },
          fetchImpl
        );
        const response = await fetchImpl(
          `https://${host}/v1/projects/${config.project}/locations/${location}/publishers/google/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
            signal: options?.signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: prompt.system }] },
              contents: [{ role: "user", parts: [{ text: prompt.user }] }],
              generationConfig: {
                maxOutputTokens: options?.maxTokens ?? 1800,
                thinkingConfig: thinkingConfigFor(model, options?.maxTokens ?? 1800),
                ...jsonConfig(options?.jsonMode),
              },
            }),
          }
        );
        if (!response.ok) return httpOutcome(response.status);
        return geminiOutcome(await response.json());
      } catch {
        return { ok: false, errorClass: "transport", retryable: true };
      }
    },
  };
}

// The chain for a purpose, built from the registry in ./adapters (kept
// exported here for apps already importing it from this path).
export { realProviders } from "./adapters";
