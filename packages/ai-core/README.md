# @sahan-sac/ai-core

The AI layer shared by `@sahan-sac/blog-kit` and `@sahan-sac/chat-kit`: a free-by-default provider chain with automatic fallback, a provider registry you can configure and extend from the environment, model resolution, image generation (NVIDIA FLUX, then paid Gemini/Vertex), and prompt-injection guards.

Headless and framework-agnostic: no Prisma, no Next.js APIs, no React. Everything takes a parsed env or config object; only `aiEnvFromProcess()` reads `process.env`.

## How a request is answered

Two patterns, kept separate:

- **Adapters.** Every provider is wrapped as an `AiProvider` with one `generate(prompt, options)` that returns `{ ok: true, text }` or a classified failure (`http_429`, `timeout`, `truncated`, `invalid_output`, ...). It never throws. Built in: Gemini, OpenRouter (two keys), NVIDIA, OpenAI, Anthropic (Claude), DeepSeek, xAI (Grok), Perplexity, one custom OpenAI-compatible endpoint (vLLM, Ollama, LiteLLM, a gateway), and Vertex AI.
- **Chain of responsibility.** `createAiService({ providers })` hands the prompt to the first provider. On any retryable failure it passes the prompt to the next one, until one answers, a non-retryable failure stops it, the deadline passes, or the caller aborts. On top of that:
  - a provider that timed out or was rate limited cools down and moves behind the healthy ones;
  - optional hedging starts the next provider while a slow one is still running, and the first valid answer wins;
  - an `accept` check turns a malformed reply into a failure, so the chain moves on.

The registry (`@sahan-sac/ai-core/adapters`) decides which adapters form a chain and in what order:

1. `AI_PROVIDER_ORDER_BLOG` or `AI_PROVIDER_ORDER_CHAT` for that purpose, else `AI_PROVIDER_ORDER`, else the default order: `gemini, openrouter, openrouter-2, nvidia, openai, anthropic, deepseek, xai, perplexity, custom, vertex`.
2. An adapter runs only when its variables are set. A paid adapter also needs `AI_ALLOW_PAID=true`, even when it is listed.
3. **Explicit order:** only the listed ids run, in that order. Speed never reorders them; cooling still does.
4. **Default order:** paid adapters are last resorts, and the free ones are reordered by observed speed.

## Subpaths

| Import | What |
| --- | --- |
| `@sahan-sac/ai-core/env` | `aiEnvSchema` (zod), `parseAiEnv(source)`, `aiEnvFromProcess()`, `AiEnv` |
| `@sahan-sac/ai-core/adapters` | `BUILTIN_ADAPTERS`, `ProviderAdapter`, `realProviders(env, purpose, fetch?, adapters?)`, `chainPlan`, `providerStatuses` (why each adapter is in or out, for health screens), `configuredOrder`, `PAID_TEXT_MODELS` |
| `@sahan-sac/ai-core/providers` | `createAiService` (the chain), `sharedAiHealth`, `realProviders` (re-exported), the provider factories: `geminiProvider`, `openRouterProvider`, `nvidiaProvider`, `openAiCompatibleProvider`, `anthropicProvider`, `vertexProvider` |
| `@sahan-sac/ai-core/availability` | `textAiConfigured(env, purpose?)`, `blogAiEnabled`, `blogAiImagesEnabled`, `chatbotEnabled` |
| `@sahan-sac/ai-core/models` | `textModels`, `imageModels`, verified free defaults, `paidAllowed`, `vertexConfigured` |
| `@sahan-sac/ai-core/image` | `imageConfigFromEnv`, `generateImage` |
| `@sahan-sac/ai-core/vertex` | `getVertexAccessToken` (service-account JWT exchange, cached) |
| `@sahan-sac/ai-core/guard` | `wrapUserData`, `looksLikeLeak`, `ModelPrompt` |
| `@sahan-sac/ai-core/log` | `AiLogger`, `consoleAiLogger` |

`providers`, `adapters`, `image` and `vertex` reach `server-only` code: use them from server code only.

## Environment

Spread the schema into your own env module so the names never drift:

```ts
import { aiEnvSchema } from "@sahan-sac/ai-core/env";

const schema = z.object({ ...aiEnvSchema.shape, DATABASE_URL: z.string() });
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `ENABLE_BLOG_AI` | `false` | Blog AI assistant (also needs a blog text provider) |
| `ENABLE_CHATBOT` | `true` | Chatbot (also needs a chat text provider); `false`/`0`/`no`/`off` turns it off |
| `AI_ALLOW_PAID` | `false` | Lets paid providers join the chains: OpenAI, Anthropic, DeepSeek, xAI, Perplexity, the custom endpoint (unless `AI_CUSTOM_FREE`), Vertex text and images, Gemini images |
| `AI_PROVIDER_ORDER`, `AI_PROVIDER_ORDER_BLOG`, `AI_PROVIDER_ORDER_CHAT` | built-in order | Comma-separated adapter ids; only the listed ones run, in that order |
| `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_API_KEY_2`, `NVIDIA_API_KEY` | unset | Free text providers; `NVIDIA_API_KEY` is also the free image provider |
| `OPENROUTER_BASE_URL`, `OPENROUTER_ALLOW_PAID_MODELS` | OpenRouter API, `false` | OpenRouter settings |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL` | unset, OpenAI API | OpenAI (paid); the base URL also points it at any OpenAI-compatible gateway |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` | unset, Anthropic API | Anthropic Messages API over REST (paid) |
| `DEEPSEEK_API_KEY`, `XAI_API_KEY`, `PERPLEXITY_API_KEY` | unset | Paid OpenAI-compatible providers |
| `AI_CUSTOM_BASE_URL`, `AI_CUSTOM_MODEL`, `AI_CUSTOM_API_KEY`, `AI_CUSTOM_NAME`, `AI_CUSTOM_FREE` | unset, `false` | One custom OpenAI-compatible endpoint. The key is optional for a local server. Paid unless `AI_CUSTOM_FREE=true` |
| `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CLOUD_PROJECT` | unset | Vertex service account (paid). Keep the key on one line with literal `\n` |
| `GOOGLE_TOKEN_URI` | Google's token endpoint | Override only for testing |
| `BLOG_<P>_MODEL`, `CHAT_<P>_MODEL`, `<P>_MODEL` | built-in defaults | Model per provider `<P>` (`GEMINI`, `OPENROUTER`, `NVIDIA`, `VERTEX`, `OPENAI`, `ANTHROPIC`, `DEEPSEEK`, `XAI`, `PERPLEXITY`): purpose variable, then provider-wide, then default. Paid-provider names change often, so set them |
| `IMAGE_*_MODEL`, `IMAGEN_MODEL` | verified free defaults | Image models |

## Example

```ts
import { chatbotEnabled } from "@sahan-sac/ai-core/availability";
import { aiEnvFromProcess } from "@sahan-sac/ai-core/env";
import { createAiService, realProviders, sharedAiHealth } from "@sahan-sac/ai-core/providers";

const env = aiEnvFromProcess();
if (chatbotEnabled(env)) {
  const ai = createAiService({ providers: realProviders(env, "chat"), health: sharedAiHealth, timeoutMs: 12_000, deadlineMs: 20_000 });
  const result = await ai.generate({ system: "You are helpful.", user: "Hello" }, { maxTokens: 200, signal: request.signal });
  // result.provider: who answered; result.attempts: every provider tried, with its error class.
}
```

Pass the request's `signal` so a client that disconnects stops the chain: every running attempt is aborted, no further provider starts, and the result is `{ ok: false, errorClass: "aborted" }`. An aborted attempt is not logged or cooled down.

## Your own adapter

```ts
import { BUILTIN_ADAPTERS, realProviders, type ProviderAdapter } from "@sahan-sac/ai-core/adapters";
import { openAiCompatibleProvider } from "@sahan-sac/ai-core/providers";

const groq: ProviderAdapter = {
  id: "groq",
  label: "Groq",
  paid: () => false,
  missing: () => (process.env.GROQ_API_KEY ? [] : ["GROQ_API_KEY"]),
  create: ({ fetch }) =>
    openAiCompatibleProvider({ name: "groq", apiKey: process.env.GROQ_API_KEY!, baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", fetch }),
};

const providers = realProviders(env, "chat", undefined, [...BUILTIN_ADAPTERS, groq]);
// Default order: the built-ins, then groq. Or list it: AI_PROVIDER_ORDER=groq,gemini
```

For a settings screen, `providerStatuses(env, purpose)` reports each adapter's state: `active` (with its position), `not_configured` (with the missing variable names, never values), `needs_paid`, `not_in_order` or `unknown`.
