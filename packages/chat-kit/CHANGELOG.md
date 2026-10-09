# @sahan-sac/chat-kit

## 0.3.1

### Patch Changes

- 5e7f3cb: The build shares modules between subpaths (code splitting) instead of copying them into each one. Before, a class imported from two subpaths was two different classes, so `instanceof` failed (for example `EmailGuardError` from `@sahan-sac/email-kit/guards` against an error thrown through `./layout`), and module-level state such as caches existed once per subpath.
- Updated dependencies [5e7f3cb]
  - @sahan-sac/ai-core@0.3.1

## 0.3.0

### Minor Changes

- f465908: Owner guidance and per-post steering. `BlogSiteProfile.guidance` and `ChatSite.guidance` add the site owner's standing guidance to every blog, SEO, helper and chatbot prompt, after the fixed rules. `BlogGenerationInput` takes optional `instructions` (up to `MAX_INSTRUCTIONS_LENGTH`, 2,000 characters) and `resources` (pasted reference text, up to `MAX_RESOURCES_LENGTH`, 12,000), both fenced as untrusted data: resources are used as facts, never as instructions, and nothing is fetched from a link.

### Patch Changes

- Updated dependencies [b9d2dd6]
- Updated dependencies [4fa21e3]
- Updated dependencies [f465908]
  - @sahan-sac/ai-core@0.3.0

## 0.2.0

### Minor Changes

- c2cc383: Site-specific values are now options with neutral defaults. blog-kit: `BlogAiDeps.site` (a `BlogSiteProfile`: description, allowed internal links, call-to-action paths) feeds every prompt, `realBlogDeps(env, site)` takes it, inline image tokens are `ai-image://N`, and `draftStorageKey(id, prefix)` takes a key prefix (default "admin"). chat-kit: `ChatSite` gains optional `kind`, `scope` and `linkExample` (default wording says "site"), and `CHAT_VISITOR_COOKIE` defaults to "chat_vid". media-kit: `MEDIA_CONFIG.uploadFolder` is removed; the upload folder is the app's own constant.

### Patch Changes

- @sahan-sac/ai-core@0.2.0

## 0.1.0

### Minor Changes

- b620f44: First release. ai-core: the free-by-default provider chain (Gemini, OpenRouter, NVIDIA, then paid Vertex) with hedging, cooldowns and deadlines, env-driven model resolution, image generation, prompt guards and the shared env schema (ENABLE_BLOG_AI, ENABLE_CHATBOT). blog-kit: full-post, SEO, draft and cover generation, AI images through an ImageSink port, and pure blog utilities. chat-kit: runChat, guarded prompts, output filtering, the knowledge builder, the ChatStore contract and the visitor rate-limit cookie. Licensed Apache-2.0.

### Patch Changes

- Updated dependencies [b620f44]
  - @sahan-sac/ai-core@0.1.0
