import "server-only";

import { providerStatuses } from "@sahan-sac/ai-core/adapters";
import { getVertexAccessToken } from "@sahan-sac/ai-core/vertex";

import { repos } from "@/lib/data";
import { getEnv } from "@/lib/env";
import { kv, kvBackend } from "@/lib/cache/redis";
import { log } from "@/lib/log";
import { checkIndexNowKeyFile } from "@/lib/seo/indexnow";

// Integration health for the settings screen: configured yes/no, plus a
// cheap live ping through an injectable fetch with a short timeout. Never
// returns a secret value or a fragment of one, only booleans and the
// human-readable name of the integration. Design: docs/plan/admin-cms-adr.md,
// Step 16.

export type IntegrationGroup = "Core" | "Email" | "Media" | "AI" | "SEO";

export interface IntegrationStatus {
  name: string;
  group: IntegrationGroup;
  /** What makes it configured and what the check does: environment variable names only, never values. */
  hint: string;
  /** Environment variables for this integration are present. */
  configured: boolean;
  /**
   * Live reachability: true/false when pinged, null when not pinged (not
   * configured, or the integration has no cheap ping — the database and
   * Redis checks always ping because they are already on the request path).
   */
  reachable: boolean | null;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const PING_TIMEOUT_MS = 2500;

async function pingUrl(fetchImpl: FetchLike, url: string, init: RequestInit): Promise<boolean> {
  try {
    const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
    return response.ok;
  } catch {
    return false;
  }
}

const DATABASE = { name: "Database", group: "Core", hint: "DATABASE_URL. Checked with SELECT 1." } as const;
const REDIS = { name: "Redis", group: "Core", hint: "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. Checked by writing and reading a 30 s probe key." } as const;
const RESEND = { name: "Resend", group: "Email", hint: "RESEND_API_KEY. Checked against the domains API; a send-only key also counts as reachable." } as const;
const BREVO = { name: "Brevo", group: "Email", hint: "EMAIL_BREVO_API_KEY. Checked against the account API." } as const;
const CLOUDINARY = {
  name: "Cloudinary",
  group: "Media",
  hint: "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET. Checked by listing one image.",
} as const;
const OPENROUTER = { name: "OpenRouter", group: "AI", hint: "OPENROUTER_API_KEY (optionally OPENROUTER_API_KEY_2). Checked against the models list." } as const;
const GEMINI = { name: "Gemini", group: "AI", hint: "GEMINI_API_KEY. Not pinged: a check would spend quota." } as const;
const NVIDIA = { name: "NVIDIA", group: "AI", hint: "NVIDIA_API_KEY. Not pinged: the API has no free check." } as const;
const VERTEX = {
  name: "Vertex AI",
  group: "AI",
  hint: "GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY and GOOGLE_CLOUD_PROJECT; used for text only while AI_ALLOW_PAID=true. Checked by the service-account token exchange, which spends no AI quota.",
} as const;
const PAID_NOTE = "Runs only while AI_ALLOW_PAID=true.";
const MODELS_NOTE = "Checked against the models list, which spends no tokens.";
const OPENAI = { name: "OpenAI", group: "AI", hint: `OPENAI_API_KEY (OPENAI_BASE_URL for a compatible gateway). ${PAID_NOTE} ${MODELS_NOTE}` } as const;
const ANTHROPIC = { name: "Anthropic (Claude)", group: "AI", hint: `ANTHROPIC_API_KEY. ${PAID_NOTE} ${MODELS_NOTE}` } as const;
const DEEPSEEK = { name: "DeepSeek", group: "AI", hint: `DEEPSEEK_API_KEY. ${PAID_NOTE} ${MODELS_NOTE}` } as const;
const XAI = { name: "xAI (Grok)", group: "AI", hint: `XAI_API_KEY. ${PAID_NOTE} ${MODELS_NOTE}` } as const;
const PERPLEXITY = { name: "Perplexity", group: "AI", hint: `PERPLEXITY_API_KEY. ${PAID_NOTE} Not pinged: the API has no free check.` } as const;
const CUSTOM_AI = {
  name: "Custom AI endpoint",
  group: "AI",
  hint: "AI_CUSTOM_BASE_URL and AI_CUSTOM_MODEL (AI_CUSTOM_API_KEY optional). Paid unless AI_CUSTOM_FREE=true. Checked against its models list.",
} as const;
const AI_CHAIN = { name: "AI chain", group: "AI", hint: "" } as const;
const INDEXNOW = { name: "IndexNow", group: "SEO", hint: "INDEXNOW_KEY and its public key file. Checked by fetching the key file." } as const;

export async function checkDatabase(): Promise<IntegrationStatus> {
  const configured = Boolean(process.env.DATABASE_URL);
  if (!configured) return { ...DATABASE, configured, reachable: null };
  try {
    await repos.maintenance.ping();
    return { ...DATABASE, configured, reachable: true };
  } catch (err) {
    log.warn("integration health: database ping failed", { error: String(err) });
    return { ...DATABASE, configured, reachable: false };
  }
}

export async function checkRedis(): Promise<IntegrationStatus> {
  const configured = kvBackend() === "upstash";
  if (!configured) return { ...REDIS, configured, reachable: null };
  try {
    const probeKey = "health:ping";
    await kv.set(probeKey, Date.now(), { ttlSeconds: 30 });
    const value = await kv.get(probeKey);
    return { ...REDIS, configured, reachable: value !== null };
  } catch (err) {
    log.warn("integration health: redis ping failed", { error: String(err) });
    return { ...REDIS, configured, reachable: false };
  }
}

export async function checkResend(fetchImpl: FetchLike = fetch): Promise<IntegrationStatus> {
  const apiKey = process.env.RESEND_API_KEY;
  const configured = Boolean(apiKey);
  if (!configured) return { ...RESEND, configured, reachable: null };
  try {
    const response = await fetchImpl("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    if (response.ok) return { ...RESEND, configured, reachable: true };
    // A send-only scoped API key correctly 401s on /domains with this error
    // name: Resend recognized the key, it is just narrower than this ping
    // needs. That is a valid, working key, not an unreachable integration.
    const body = (await response.json().catch(() => null)) as { name?: string } | null;
    const scopedButValid = response.status === 401 && body?.name === "restricted_api_key";
    return { ...RESEND, configured, reachable: scopedButValid };
  } catch {
    return { ...RESEND, configured, reachable: false };
  }
}

export async function checkBrevo(fetchImpl: FetchLike = fetch): Promise<IntegrationStatus> {
  const apiKey = process.env.EMAIL_BREVO_API_KEY;
  const configured = Boolean(apiKey);
  if (!configured) return { ...BREVO, configured, reachable: null };
  const reachable = await pingUrl(fetchImpl, "https://api.brevo.com/v3/account", {
    headers: { "api-key": apiKey as string },
  });
  return { ...BREVO, configured, reachable };
}

export async function checkCloudinary(fetchImpl: FetchLike = fetch): Promise<IntegrationStatus> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  const configured = Boolean(cloud && key && secret);
  if (!configured) return { ...CLOUDINARY, configured, reachable: null };
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const reachable = await pingUrl(fetchImpl, `https://api.cloudinary.com/v1_1/${cloud}/resources/image?max_results=1`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return { ...CLOUDINARY, configured, reachable };
}

export async function checkOpenRouter(fetchImpl: FetchLike = fetch): Promise<IntegrationStatus> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const configured = Boolean(apiKey);
  if (!configured) return { ...OPENROUTER, configured, reachable: null };
  const reachable = await pingUrl(fetchImpl, "https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return { ...OPENROUTER, configured, reachable };
}

export async function checkGemini(): Promise<IntegrationStatus> {
  // Configured-only: pinging costs a quota unit against a paid API for a
  // screen that just wants a yes/no.
  return { ...GEMINI, configured: Boolean(process.env.GEMINI_API_KEY), reachable: null };
}

export async function checkNvidia(): Promise<IntegrationStatus> {
  return { ...NVIDIA, configured: Boolean(process.env.NVIDIA_API_KEY), reachable: null };
}

/**
 * Configured: the service account is complete. Reachable: Google issues it an
 * access token (the same exchange every Vertex call makes, cached for about an
 * hour), which costs no AI quota. Checked even while AI_ALLOW_PAID is off, so
 * a broken key shows up before it is switched on.
 */
export async function checkVertex(fetchImpl: FetchLike = fetch): Promise<IntegrationStatus> {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const configured = Boolean(clientEmail && privateKey && process.env.GOOGLE_CLOUD_PROJECT);
  if (!configured) return { ...VERTEX, configured, reachable: null };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), PING_TIMEOUT_MS);
    });
    const account = {
      clientEmail: clientEmail as string,
      privateKey: (privateKey as string).replace(/\\n/g, "\n"),
      tokenUri: process.env.GOOGLE_TOKEN_URI || "https://oauth2.googleapis.com/token",
    };
    await Promise.race([getVertexAccessToken(account, fetchImpl as typeof fetch), timeout]);
    return { ...VERTEX, configured, reachable: true };
  } catch {
    return { ...VERTEX, configured, reachable: false };
  } finally {
    clearTimeout(timer);
  }
}

const trimBase = (url: string) => url.replace(/\/+$/, "");

/** A models list: free on every API that has one, and proof the key works. */
async function checkModelsList(
  meta: Omit<IntegrationStatus, "configured" | "reachable">,
  apiKey: string | undefined,
  url: string,
  fetchImpl: FetchLike,
  headers: (key: string) => Record<string, string> = (key) => ({ Authorization: `Bearer ${key}` })
): Promise<IntegrationStatus> {
  if (!apiKey) return { ...meta, configured: false, reachable: null };
  return { ...meta, configured: true, reachable: await pingUrl(fetchImpl, url, { headers: headers(apiKey) }) };
}

export const checkOpenAi = (fetchImpl: FetchLike = fetch) =>
  checkModelsList(OPENAI, process.env.OPENAI_API_KEY, `${trimBase(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1")}/models`, fetchImpl);

export const checkAnthropic = (fetchImpl: FetchLike = fetch) =>
  checkModelsList(
    ANTHROPIC,
    process.env.ANTHROPIC_API_KEY,
    `${trimBase(process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com")}/v1/models`,
    fetchImpl,
    (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" })
  );

export const checkDeepSeek = (fetchImpl: FetchLike = fetch) =>
  checkModelsList(DEEPSEEK, process.env.DEEPSEEK_API_KEY, "https://api.deepseek.com/models", fetchImpl);

export const checkXai = (fetchImpl: FetchLike = fetch) => checkModelsList(XAI, process.env.XAI_API_KEY, "https://api.x.ai/v1/models", fetchImpl);

export async function checkPerplexity(): Promise<IntegrationStatus> {
  return { ...PERPLEXITY, configured: Boolean(process.env.PERPLEXITY_API_KEY), reachable: null };
}

export async function checkCustomAi(fetchImpl: FetchLike = fetch): Promise<IntegrationStatus> {
  const base = process.env.AI_CUSTOM_BASE_URL;
  const configured = Boolean(base && process.env.AI_CUSTOM_MODEL);
  if (!configured) return { ...CUSTOM_AI, configured, reachable: null };
  const key = process.env.AI_CUSTOM_API_KEY;
  const reachable = await pingUrl(fetchImpl, `${trimBase(base!)}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
  return { ...CUSTOM_AI, configured, reachable };
}

/**
 * Which providers each AI chain tries, in order (@sahan-sac/ai-core/adapters):
 * set by AI_PROVIDER_ORDER(_BLOG|_CHAT), filtered by keys and AI_ALLOW_PAID.
 * No network: a provider that fails at request time hands over to the next.
 */
export function checkAiChains(): IntegrationStatus[] {
  const env = getEnv();
  return (["blog", "chat"] as const).map((purpose) => {
    const statuses = providerStatuses(env, purpose);
    const active = statuses.filter((status) => status.state === "active").map((status) => status.id);
    const waiting = statuses.filter((status) => status.state === "needs_paid").map((status) => status.id);
    const unknown = statuses.filter((status) => status.state === "unknown").map((status) => status.id);
    const parts = [
      active.length ? `Tries ${active.join(" → ")}, each failure falling through to the next.` : "No provider can answer.",
      waiting.length ? `Configured but paid, off until AI_ALLOW_PAID=true: ${waiting.join(", ")}.` : "",
      unknown.length ? `Unknown ids in the order: ${unknown.join(", ")}.` : "",
      `Order: AI_PROVIDER_ORDER_${purpose.toUpperCase()} or AI_PROVIDER_ORDER.`,
    ];
    return { ...AI_CHAIN, name: `AI chain (${purpose})`, hint: parts.filter(Boolean).join(" "), configured: active.length > 0, reachable: null };
  });
}

export async function checkIndexNow(): Promise<IntegrationStatus> {
  const result = await checkIndexNowKeyFile();
  return { ...INDEXNOW, configured: result.configured, reachable: result.configured ? result.ok : null };
}

/**
 * Every integration's status, each check isolated so one failure (a timeout,
 * a thrown error) never hides the others. `fetchImpl` is injectable for
 * tests; production callers omit it and get the global fetch.
 */
export async function getIntegrationHealth(fetchImpl: FetchLike = fetch): Promise<IntegrationStatus[]> {
  const checks = [
    checkDatabase(),
    checkRedis(),
    checkResend(fetchImpl),
    checkBrevo(fetchImpl),
    checkCloudinary(fetchImpl),
    checkOpenRouter(fetchImpl),
    checkGemini(),
    checkNvidia(),
    checkVertex(fetchImpl),
    checkOpenAi(fetchImpl),
    checkAnthropic(fetchImpl),
    checkDeepSeek(fetchImpl),
    checkXai(fetchImpl),
    checkPerplexity(),
    checkCustomAi(fetchImpl),
    checkIndexNow(),
  ];
  const results = await Promise.allSettled(checks);
  const statuses = results.map((result, index) =>
    result.status === "fulfilled" ? result.value : { ...INTEGRATIONS[index], configured: false, reachable: false }
  );
  let chains: IntegrationStatus[];
  try {
    chains = checkAiChains();
  } catch {
    chains = [];
  }
  return [...statuses, ...chains];
}

const INTEGRATIONS = [DATABASE, REDIS, RESEND, BREVO, CLOUDINARY, OPENROUTER, GEMINI, NVIDIA, VERTEX, OPENAI, ANTHROPIC, DEEPSEEK, XAI, PERPLEXITY, CUSTOM_AI, INDEXNOW];

const HEALTH_TTL_MS = 60_000;
let healthCache: { at: number; value: Promise<IntegrationStatus[]> } | null = null;

/**
 * getIntegrationHealth for the settings screen: one run per minute per server
 * instance, shared by concurrent requests, so reloading the page never fans
 * out a burst of pings to every provider. A run that throws is not kept.
 */
export function getCachedIntegrationHealth(now = Date.now()): Promise<IntegrationStatus[]> {
  if (healthCache && now - healthCache.at < HEALTH_TTL_MS) return healthCache.value;
  const value = getIntegrationHealth().catch((error: unknown) => {
    healthCache = null;
    throw error;
  });
  healthCache = { at: now, value };
  return value;
}
