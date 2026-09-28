# @sahan-sac/ai-core

The AI layer shared by `@sahan-sac/blog-kit` and `@sahan-sac/chat-kit`: a free-by-default provider chain (Gemini, OpenRouter, NVIDIA, then paid Vertex), model resolution from environment variables, image generation (NVIDIA FLUX, then paid Gemini/Vertex), and prompt-injection guards.

Headless and framework-agnostic: no Prisma, no Next.js APIs, no React. Everything takes a parsed env or config object; only `aiEnvFromProcess()` reads `process.env`.

## Subpaths

| Import | What |
| --- | --- |
| `@sahan-sac/ai-core/env` | `aiEnvSchema` (zod), `parseAiEnv(source)`, `aiEnvFromProcess()`, `AiEnv` |
| `@sahan-sac/ai-core/availability` | `textAiConfigured`, `blogAiEnabled`, `blogAiImagesEnabled`, `chatbotEnabled` |
| `@sahan-sac/ai-core/providers` | `createAiService` (ordered chain, hedging, cooldowns, deadlines, output validation), `realProviders(env, "blog" \| "chat")`, `sharedAiHealth`, provider factories |
| `@sahan-sac/ai-core/models` | `textModels`, `imageModels`, verified free defaults, `paidAllowed`, `vertexConfigured` |
| `@sahan-sac/ai-core/image` | `imageConfigFromEnv`, `generateImage` |
| `@sahan-sac/ai-core/vertex` | `getVertexAccessToken` (service-account JWT exchange, cached) |
| `@sahan-sac/ai-core/guard` | `wrapUserData`, `looksLikeLeak`, `ModelPrompt` |
| `@sahan-sac/ai-core/log` | `AiLogger`, `consoleAiLogger` |

`providers`, `image` and `vertex` import `server-only`: use them from server code only.

## Environment

Spread the schema into your own env module so the names never drift:

```ts
import { aiEnvSchema } from "@sahan-sac/ai-core/env";

const schema = z.object({ ...aiEnvSchema.shape, DATABASE_URL: z.string() });
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `ENABLE_BLOG_AI` | `false` | Blog AI assistant (also needs a text provider key) |
| `ENABLE_CHATBOT` | `true` | Chatbot (also needs a text provider key); `false`/`0`/`no`/`off` turns it off |
| `AI_ALLOW_PAID` | `false` | Lets paid providers (Vertex text and images, Gemini images) join the chains |
| `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_API_KEY_2`, `NVIDIA_API_KEY` | unset | Free text providers; `NVIDIA_API_KEY` is also the free image provider |
| `OPENROUTER_BASE_URL`, `OPENROUTER_ALLOW_PAID_MODELS` | OpenRouter API, `false` | OpenRouter settings |
| `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CLOUD_PROJECT` | unset | Vertex service account (paid). Keep the key on one line with literal `\n` |
| `GOOGLE_TOKEN_URI` | Google's token endpoint | Override only for testing |
| `BLOG_*_MODEL`, `CHAT_*_MODEL`, `IMAGE_*_MODEL`, `*_MODEL`, `IMAGEN_MODEL` | verified free defaults | Model overrides: purpose variable, then provider-wide, then default |

## Example

```ts
import { chatbotEnabled } from "@sahan-sac/ai-core/availability";
import { aiEnvFromProcess } from "@sahan-sac/ai-core/env";
import { createAiService, realProviders, sharedAiHealth } from "@sahan-sac/ai-core/providers";

const env = aiEnvFromProcess();
if (chatbotEnabled(env)) {
  const ai = createAiService({ providers: realProviders(env, "chat"), health: sharedAiHealth, timeoutMs: 12_000, deadlineMs: 20_000 });
  const result = await ai.generate({ system: "You are helpful.", user: "Hello" }, { maxTokens: 200 });
}
```
