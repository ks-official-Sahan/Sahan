import type { AiEnv } from "./env";
import { paidAllowed, textModels, vertexConfigured, type TextPurpose } from "./models";
import {
  anthropicProvider,
  geminiProvider,
  openAiCompatibleProvider,
  openRouterProvider,
  vertexProvider,
  type AiProvider,
} from "./providers";

// The provider registry (adapter pattern): each adapter knows the env
// variables it needs (its guard), whether it costs money, and how to build its
// AiProvider. A chain for a purpose is the configured adapters in order;
// createAiService() then runs it as a chain of responsibility, passing the
// request to the next provider whenever one fails.
//
// Order: AI_PROVIDER_ORDER_BLOG / AI_PROVIDER_ORDER_CHAT, else
// AI_PROVIDER_ORDER, else DEFAULT_ORDER. An explicit order lists exactly the
// providers that run, keeps that order (speed no longer reorders it), and
// still never runs a paid provider without AI_ALLOW_PAID. With the default
// order, paid providers are last resorts.

export interface AdapterContext {
  env: AiEnv;
  purpose: TextPurpose;
  fetch?: typeof fetch;
}

export interface ProviderAdapter {
  /** Lowercase id used in AI_PROVIDER_ORDER. */
  readonly id: string;
  readonly label: string;
  /** Costs money: runs only with AI_ALLOW_PAID. */
  paid(env: AiEnv): boolean;
  /** Env variable names still missing; empty means configured. Never values. */
  missing(env: AiEnv): string[];
  create(context: AdapterContext): AiProvider;
}

/** `${PURPOSE}_${PROVIDER}_MODEL`, then `${PROVIDER}_MODEL`, then the default. */
function modelFor(env: AiEnv, provider: string, purpose: TextPurpose, fallback: Record<TextPurpose, string>): string {
  const record = env as unknown as Record<string, string | undefined>;
  return record[`${purpose.toUpperCase()}_${provider}_MODEL`] || record[`${provider}_MODEL`] || fallback[purpose];
}

const need = (env: AiEnv, ...names: Array<keyof AiEnv>): string[] => names.filter((name) => !env[name]) as string[];

/**
 * Defaults for the paid adapters. Model names change often: set the
 * provider's *_MODEL variable rather than relying on these.
 */
export const PAID_TEXT_MODELS = {
  openai: { blog: "gpt-5-mini", chat: "gpt-5-nano" },
  anthropic: { blog: "claude-sonnet-5-5", chat: "claude-haiku-4-5-20251001" },
  deepseek: { blog: "deepseek-chat", chat: "deepseek-chat" },
  xai: { blog: "grok-3-mini", chat: "grok-3-mini" },
  perplexity: { blog: "sonar", chat: "sonar" },
} as const satisfies Record<string, Record<TextPurpose, string>>;

/** An OpenAI-compatible paid API with a key, a fixed base URL and a model per purpose. */
function compatibleAdapter(spec: {
  id: keyof typeof PAID_TEXT_MODELS;
  label: string;
  envPrefix: string;
  keyVar: keyof AiEnv;
  baseUrl: string;
  baseUrlVar?: keyof AiEnv;
}): ProviderAdapter {
  return {
    id: spec.id,
    label: spec.label,
    paid: () => true,
    missing: (env) => need(env, spec.keyVar),
    create: ({ env, purpose, fetch }) =>
      openAiCompatibleProvider({
        name: spec.id,
        apiKey: env[spec.keyVar] as string,
        baseUrl: (spec.baseUrlVar && (env[spec.baseUrlVar] as string | undefined)) || spec.baseUrl,
        model: modelFor(env, spec.envPrefix, purpose, PAID_TEXT_MODELS[spec.id]),
        fetch,
      }),
  };
}

const openRouterAdapter = (id: string, keyVar: "OPENROUTER_API_KEY" | "OPENROUTER_API_KEY_2"): ProviderAdapter => ({
  id,
  label: id === "openrouter" ? "OpenRouter" : "OpenRouter (second key)",
  // Free models only, unless OPENROUTER_ALLOW_PAID_MODELS: the adapter itself refuses a paid model id.
  paid: () => false,
  missing: (env) => need(env, keyVar),
  create: ({ env, purpose, fetch }) =>
    openRouterProvider({
      apiKey: env[keyVar]!,
      model: textModels(env, purpose).openrouter,
      baseUrl: env.OPENROUTER_BASE_URL,
      allowPaidModels: env.OPENROUTER_ALLOW_PAID_MODELS,
      fetch,
      name: id,
    }),
});

export const BUILTIN_ADAPTERS: readonly ProviderAdapter[] = [
  {
    id: "gemini",
    label: "Gemini",
    paid: () => false,
    missing: (env) => need(env, "GEMINI_API_KEY"),
    create: ({ env, purpose, fetch }) => geminiProvider({ apiKey: env.GEMINI_API_KEY!, model: textModels(env, purpose).gemini, fetchImpl: fetch }),
  },
  openRouterAdapter("openrouter", "OPENROUTER_API_KEY"),
  openRouterAdapter("openrouter-2", "OPENROUTER_API_KEY_2"),
  {
    id: "nvidia",
    label: "NVIDIA",
    paid: () => false,
    missing: (env) => need(env, "NVIDIA_API_KEY"),
    create: ({ env, purpose, fetch }) =>
      openAiCompatibleProvider({
        name: "nvidia",
        apiKey: env.NVIDIA_API_KEY!,
        baseUrl: "https://integrate.api.nvidia.com/v1",
        model: textModels(env, purpose).nvidia,
        fetch,
      }),
  },
  compatibleAdapter({ id: "openai", label: "OpenAI", envPrefix: "OPENAI", keyVar: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1", baseUrlVar: "OPENAI_BASE_URL" }),
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    paid: () => true,
    missing: (env) => need(env, "ANTHROPIC_API_KEY"),
    create: ({ env, purpose, fetch }) =>
      anthropicProvider({
        apiKey: env.ANTHROPIC_API_KEY!,
        baseUrl: env.ANTHROPIC_BASE_URL,
        model: modelFor(env, "ANTHROPIC", purpose, PAID_TEXT_MODELS.anthropic),
        fetchImpl: fetch,
      }),
  },
  compatibleAdapter({ id: "deepseek", label: "DeepSeek", envPrefix: "DEEPSEEK", keyVar: "DEEPSEEK_API_KEY", baseUrl: "https://api.deepseek.com/v1" }),
  compatibleAdapter({ id: "xai", label: "xAI (Grok)", envPrefix: "XAI", keyVar: "XAI_API_KEY", baseUrl: "https://api.x.ai/v1" }),
  compatibleAdapter({ id: "perplexity", label: "Perplexity", envPrefix: "PERPLEXITY", keyVar: "PERPLEXITY_API_KEY", baseUrl: "https://api.perplexity.ai" }),
  {
    id: "custom",
    label: "Custom OpenAI-compatible",
    paid: (env) => !env.AI_CUSTOM_FREE,
    missing: (env) => need(env, "AI_CUSTOM_BASE_URL", "AI_CUSTOM_MODEL"),
    create: ({ env, fetch }) =>
      openAiCompatibleProvider({
        name: env.AI_CUSTOM_NAME ? `custom:${env.AI_CUSTOM_NAME}` : "custom",
        // A local server may take no key; the header must still be well formed.
        apiKey: env.AI_CUSTOM_API_KEY ?? "none",
        baseUrl: env.AI_CUSTOM_BASE_URL!,
        model: env.AI_CUSTOM_MODEL!,
        fetch,
      }),
  },
  {
    id: "vertex",
    label: "Vertex AI",
    paid: () => true,
    missing: (env) => (vertexConfigured(env) ? [] : need(env, "GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_CLOUD_PROJECT")),
    create: ({ env, purpose, fetch }) =>
      vertexProvider({
        clientEmail: env.GOOGLE_CLIENT_EMAIL!,
        privateKey: env.GOOGLE_PRIVATE_KEY!,
        tokenUri: env.GOOGLE_TOKEN_URI,
        project: env.GOOGLE_CLOUD_PROJECT!,
        model: textModels(env, purpose).vertex,
        fetchImpl: fetch,
      }),
  },
];

/** Free tiers first (fastest, most reliable first), paid last. */
export const DEFAULT_ORDER = BUILTIN_ADAPTERS.map((adapter) => adapter.id);

/** The order variable that applies to a purpose, parsed: lowercase ids, no repeats. Null when unset. */
export function configuredOrder(env: AiEnv, purpose: TextPurpose): string[] | null {
  const raw = (purpose === "blog" ? env.AI_PROVIDER_ORDER_BLOG : env.AI_PROVIDER_ORDER_CHAT) ?? env.AI_PROVIDER_ORDER;
  if (!raw) return null;
  const ids = raw.split(",").map((id) => id.trim().toLowerCase()).filter(Boolean);
  return ids.length ? [...new Set(ids)] : null;
}

export type AdapterState = "active" | "not_configured" | "needs_paid" | "not_in_order" | "unknown";

export interface AdapterStatus {
  id: string;
  label: string;
  paid: boolean;
  state: AdapterState;
  /** Position in the chain (0 first) when active. */
  position?: number;
  /** Missing variable names when not configured. */
  missing: string[];
}

/** Every adapter's place for a purpose: in the chain or why not. Pure, no network; for health screens. */
export function providerStatuses(env: AiEnv, purpose: TextPurpose, adapters: readonly ProviderAdapter[] = BUILTIN_ADAPTERS): AdapterStatus[] {
  const order = configuredOrder(env, purpose);
  const ids = order ?? adapters.map((adapter) => adapter.id);
  const byId = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  let position = 0;
  const statuses: AdapterStatus[] = [];
  for (const id of ids) {
    const adapter = byId.get(id);
    if (!adapter) {
      statuses.push({ id, label: id, paid: false, state: "unknown", missing: [] });
      continue;
    }
    const missing = adapter.missing(env);
    const paid = adapter.paid(env);
    const state: AdapterState = missing.length ? "not_configured" : paid && !paidAllowed(env) ? "needs_paid" : "active";
    statuses.push({ id, label: adapter.label, paid, state, missing, ...(state === "active" ? { position: position++ } : {}) });
  }
  for (const adapter of adapters) {
    if (!ids.includes(adapter.id)) {
      statuses.push({ id: adapter.id, label: adapter.label, paid: adapter.paid(env), state: "not_in_order", missing: adapter.missing(env) });
    }
  }
  return statuses;
}

/** The adapters that run for a purpose, in order, without building anything. */
export function chainPlan(env: AiEnv, purpose: TextPurpose, adapters: readonly ProviderAdapter[] = BUILTIN_ADAPTERS): ProviderAdapter[] {
  const byId = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  return providerStatuses(env, purpose, adapters)
    .filter((status) => status.state === "active")
    .map((status) => byId.get(status.id)!);
}

/**
 * The provider chain for a purpose. Pass `adapters` to add your own (for
 * example `[...BUILTIN_ADAPTERS, myAdapter]`) and list its id in
 * AI_PROVIDER_ORDER, or rely on the default order (built-ins, then yours).
 */
export function realProviders(
  env: AiEnv,
  purpose: TextPurpose,
  fetchImpl?: typeof fetch,
  adapters: readonly ProviderAdapter[] = BUILTIN_ADAPTERS
): AiProvider[] {
  const explicit = configuredOrder(env, purpose) !== null;
  return chainPlan(env, purpose, adapters).map((adapter, index) => {
    const provider = adapter.create({ env, purpose, fetch: fetchImpl });
    // Explicit order: the operator's sequence stands. Default: paid ones go last.
    return explicit
      ? { name: provider.name, generate: provider.generate, priority: index }
      : { name: provider.name, generate: provider.generate, lastResort: adapter.paid(env) || provider.lastResort };
  });
}
