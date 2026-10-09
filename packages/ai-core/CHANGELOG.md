# @sahan-sac/ai-core

## 0.3.1

### Patch Changes

- 5e7f3cb: The build shares modules between subpaths (code splitting) instead of copying them into each one. Before, a class imported from two subpaths was two different classes, so `instanceof` failed (for example `EmailGuardError` from `@sahan-sac/email-kit/guards` against an error thrown through `./layout`), and module-level state such as caches existed once per subpath.

## 0.3.0

### Minor Changes

- b9d2dd6: `createAiService().generate()` takes an optional `signal`. Aborting it stops the chain at once: running attempts are aborted, no further provider starts, and the result is `errorClass: "aborted"`. Aborted attempts are not logged and do not put a provider into cooldown.
- 4fa21e3: Provider registry and more providers. New `@sahan-sac/ai-core/adapters`: each provider is an adapter with its own env guard and paid flag (`BUILTIN_ADAPTERS`), and `realProviders` builds the chain from it. Added OpenAI, Anthropic (Messages API over REST), DeepSeek, xAI, Perplexity and one custom OpenAI-compatible endpoint (`AI_CUSTOM_*`), all paid and gated by `AI_ALLOW_PAID` (the custom one unless `AI_CUSTOM_FREE`). `AI_PROVIDER_ORDER`, `AI_PROVIDER_ORDER_BLOG` and `AI_PROVIDER_ORDER_CHAT` choose which providers run and in what order; an explicit order is kept as given (`AiProvider.priority`), while cooling providers still drop behind healthy ones. `providerStatuses` explains each adapter's place for health screens, `textAiConfigured(env, purpose?)` checks one purpose's chain, and apps can pass their own adapters to `realProviders`. New factories `openAiCompatibleProvider` and `anthropicProvider`. Existing variables and `realProviders(env, purpose, fetch?)` work as before.
- f465908: Owner guidance and on-demand checks. `@sahan-sac/ai-core/guard` adds `guidanceSection(text)`, which appends the site owner's standing guidance after a prompt's fixed rules (it steers, never overrides them, and never changes how fenced data is treated), `mergeGuidance(...parts)` to join global and per-feature guidance, and an optional `maxLength` on `wrapUserData`. `@sahan-sac/ai-core/adapters` adds `checkProvider(env, id)` and `checkChain(env, purpose)`: each sends a one-line prompt (a few tokens) through one adapter or a whole chain and reports who answered, how long it took and every fall-through, for a health screen's manual Check button. Neither runs on its own, and neither cools a provider down for real traffic.

## 0.2.0

No changes in this release.

## 0.1.0

### Minor Changes

- b620f44: First release. ai-core: the free-by-default provider chain (Gemini, OpenRouter, NVIDIA, then paid Vertex) with hedging, cooldowns and deadlines, env-driven model resolution, image generation, prompt guards and the shared env schema (ENABLE_BLOG_AI, ENABLE_CHATBOT). blog-kit: full-post, SEO, draft and cover generation, AI images through an ImageSink port, and pure blog utilities. chat-kit: runChat, guarded prompts, output filtering, the knowledge builder, the ChatStore contract and the visitor rate-limit cookie. Licensed Apache-2.0.
