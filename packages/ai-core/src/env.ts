import { z } from "zod";

// The AI environment, shared by every package and app that uses ai-core, so a
// variable means the same thing everywhere. Apps spread `aiEnvSchema.shape`
// into their own schema (so names can never drift); anything else can call
// parseAiEnv()/aiEnvFromProcess(). Error messages name variables, never values.

const text = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const ON = ["1", "true", "yes", "on"];

/** Unset or unrecognised = false. */
const flag = z
  .string()
  .optional()
  .transform((value) => ON.includes((value ?? "").trim().toLowerCase()));

/** Unset or blank = true; any other value must be an "on" word to stay true. */
const flagDefaultOn = z
  .string()
  .optional()
  .transform((value) => {
    const normalized = (value ?? "").trim().toLowerCase();
    return normalized === "" || ON.includes(normalized);
  });

/** Service-account keys are usually stored on one line with literal "\n". */
const privateKey = text.transform((value) => value?.replace(/\\n/g, "\n"));

export const DEFAULT_GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";

export const aiEnvSchema = z.object({
  // Paid providers (Vertex text and images, Gemini images) join the chains
  // only with AI_ALLOW_PAID; off by default, so AI costs $0.
  AI_ALLOW_PAID: flag,
  // Feature switches. The blog assistant is off until turned on; the chatbot
  // is on unless turned off. Each also needs a text provider key.
  ENABLE_BLOG_AI: flag,
  ENABLE_CHATBOT: flagDefaultOn,

  OPENROUTER_BASE_URL: text,
  OPENROUTER_API_KEY: text,
  OPENROUTER_API_KEY_2: text,
  OPENROUTER_ALLOW_PAID_MODELS: flag,
  GEMINI_API_KEY: text,
  NVIDIA_API_KEY: text,

  // Model overrides, all optional (models.ts): purpose variable, then the
  // provider-wide *_MODEL, then a verified free default.
  OPENROUTER_MODEL: text,
  GEMINI_MODEL: text,
  NVIDIA_MODEL: text,
  VERTEX_MODEL: text,
  IMAGEN_MODEL: text,
  BLOG_GEMINI_MODEL: text,
  BLOG_OPENROUTER_MODEL: text,
  BLOG_NVIDIA_MODEL: text,
  BLOG_VERTEX_MODEL: text,
  CHAT_GEMINI_MODEL: text,
  CHAT_OPENROUTER_MODEL: text,
  CHAT_NVIDIA_MODEL: text,
  CHAT_VERTEX_MODEL: text,
  IMAGE_NVIDIA_MODEL: text,
  IMAGE_GEMINI_MODEL: text,
  IMAGE_VERTEX_MODEL: text,

  // Provider order (./adapters). Comma-separated adapter ids; only the listed
  // ones run, in that order. Per purpose first, then the global one; unset =
  // the built-in order (free tiers first, paid last).
  AI_PROVIDER_ORDER: text,
  AI_PROVIDER_ORDER_BLOG: text,
  AI_PROVIDER_ORDER_CHAT: text,

  // Paid OpenAI-compatible and Anthropic providers: each joins a chain only
  // with its key set and AI_ALLOW_PAID on. Models: purpose variable, then the
  // provider-wide one, then the default in ./adapters.
  OPENAI_API_KEY: text,
  OPENAI_BASE_URL: text,
  OPENAI_MODEL: text,
  BLOG_OPENAI_MODEL: text,
  CHAT_OPENAI_MODEL: text,
  ANTHROPIC_API_KEY: text,
  ANTHROPIC_BASE_URL: text,
  ANTHROPIC_MODEL: text,
  BLOG_ANTHROPIC_MODEL: text,
  CHAT_ANTHROPIC_MODEL: text,
  DEEPSEEK_API_KEY: text,
  DEEPSEEK_MODEL: text,
  BLOG_DEEPSEEK_MODEL: text,
  CHAT_DEEPSEEK_MODEL: text,
  XAI_API_KEY: text,
  XAI_MODEL: text,
  BLOG_XAI_MODEL: text,
  CHAT_XAI_MODEL: text,
  PERPLEXITY_API_KEY: text,
  PERPLEXITY_MODEL: text,
  BLOG_PERPLEXITY_MODEL: text,
  CHAT_PERPLEXITY_MODEL: text,

  // One custom OpenAI-compatible endpoint (a gateway, vLLM, Ollama, LiteLLM).
  // Treated as paid unless AI_CUSTOM_FREE is on; the key is optional for a
  // local server.
  AI_CUSTOM_BASE_URL: text,
  AI_CUSTOM_API_KEY: text,
  AI_CUSTOM_MODEL: text,
  AI_CUSTOM_NAME: text,
  AI_CUSTOM_FREE: flag,

  // Google Vertex service account (paid).
  GOOGLE_CLIENT_EMAIL: text,
  GOOGLE_PRIVATE_KEY: privateKey,
  GOOGLE_CLOUD_PROJECT: text,
  GOOGLE_TOKEN_URI: text.transform((value) => value ?? DEFAULT_GOOGLE_TOKEN_URI),
});

export type AiEnv = z.infer<typeof aiEnvSchema>;

export type EnvSource = Record<string, string | undefined>;

/** Parses the AI variables; throws naming the bad variables, never their values. */
export function parseAiEnv(source: EnvSource): AiEnv {
  const result = aiEnvSchema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "?")))];
    throw new Error(`Invalid AI environment variables: ${names.join(", ")}`);
  }
  return result.data;
}

/** Convenience for apps without their own env module: reads process.env. */
export function aiEnvFromProcess(): AiEnv {
  return parseAiEnv(process.env);
}
