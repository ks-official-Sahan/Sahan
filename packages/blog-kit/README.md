# @sahan-sac/blog-kit

Headless AI blog toolkit built on `@sahan-sac/ai-core`. It covers:

- full-post generation, with a JSON response schema, a repair pass and a 42 s text budget;
- SEO suggestions;
- the draft, cover and full-post helpers;
- AI images through an `ImageSink` port;
- pure blog utilities.

It is headless and framework-agnostic: no Prisma, no Next.js APIs, no React, and no storage service. The host app keeps:

- the routes, with auth, availability, origin checks and rate limits first;
- the post schema and queries;
- rendering with its HTML sanitizer;
- revisions storage, the editor UI and where images are kept.

## Subpaths

| Import | What |
| --- | --- |
| `@sahan-sac/blog-kit/deps` | `realBlogDeps(env, site?)` (blog provider chain + shared health + site profile), `BlogAiDeps`, `AiHelperFailure` |
| `@sahan-sac/blog-kit/generate` | `generateBlogPost`, `generateSeoSuggestion`, `blogGenerationSchema`, `BLOG_RESPONSE_SCHEMA`, `TEXT_BUDGET_MS`, JSON repair helpers |
| `@sahan-sac/blog-kit/helpers` | `draftPost`, `suggestCover`, `generateFullPost` |
| `@sahan-sac/blog-kit/prompts` | Full-post, repair and SEO prompt builders (caller input fenced as data) |
| `@sahan-sac/blog-kit/helper-prompts` | Draft, cover and full-post helper prompts |
| `@sahan-sac/blog-kit/images` | `generateBlogImage(prompt, options, { config, sink })`, `ImageSink` |
| `@sahan-sac/blog-kit/ai-image-tokens` | Inline image placeholders in generated Markdown (`applyImageToken`, `removeImageToken`) and in the editor's HTML (`applyImageTokenToHtml`) |
| `@sahan-sac/blog-kit/markdown` | `markdownToHtml`, `htmlToMarkdown` (charts and heading ids included) |
| `@sahan-sac/blog-kit/chart` | Chart code blocks to accessible SVG figures |
| `@sahan-sac/blog-kit/slug` | `slugify`, `isValidSlug`, `ensureUniqueSlug` |
| `@sahan-sac/blog-kit/readtime` | `computeReadMinutes` |
| `@sahan-sac/blog-kit/revisions` | Post snapshot schema and comparison, `REVISIONS_KEPT` |
| `@sahan-sac/blog-kit/draft` | Browser draft autosave keys (`draftStorageKey(id, prefix = "admin")`) and freshness check |
| `@sahan-sac/blog-kit/concurrency` | `parseSubmittedUpdatedAt`, conflict message for optimistic concurrency |

`generate` and `helpers` import `server-only`, and `deps` and `images` reach the provider code. The utilities (`markdown`, `chart`, `slug`, `readtime`, `revisions`, `draft`, `concurrency`, `ai-image-tokens`) are browser-safe.

## Environment

Uses `@sahan-sac/ai-core`'s variables; see its README. Offer the blog AI only when `blogAiEnabled(env)` is true: `ENABLE_BLOG_AI=true`, which is off by default, and a provider that can answer for the blog (its key set, in `AI_PROVIDER_ORDER_BLOG` or `AI_PROVIDER_ORDER` when one is set, and `AI_ALLOW_PAID=true` for a paid one). Every generator runs the blog chain, so a failing provider hands over to the next. Offer images only when `blogAiImagesEnabled(env)` is true, which also needs an image provider. Both functions are in `@sahan-sac/ai-core/availability`.

## Wiring

```ts
import { imageConfigFromEnv } from "@sahan-sac/ai-core/image";
import { realBlogDeps } from "@sahan-sac/blog-kit/deps";
import { generateBlogPost } from "@sahan-sac/blog-kit/generate";
import { generateBlogImage } from "@sahan-sac/blog-kit/images";

// Every prompt describes the site and may only link to these paths. All optional:
// the defaults are "this site", ["/"] and no call-to-action path.
const site = { description: "a bakery's site", internalLinks: ["/", "/menu", "/contact"], callToAction: ["/contact"] };

// `signal` stops the model calls (and skips the repair) when the client goes away.
const result = await generateBlogPost(input, realBlogDeps(env, site), { onStatus: (status) => send("provider_status", status), signal: request.signal });
if (!result.ok) return send("error", { error: result.error });

const config = imageConfigFromEnv(env);
if (config) {
  const image = await generateBlogImage(
    result.post.featuredImage.prompt,
    { alt: result.post.featuredImage.alt, folder: "blog/ai", aspectRatio: "16:9", signal },
    { config, sink: mediaLibrarySink(actor) }
  );
}
```

`ImageSink` is where generated images go. A media-library sink uploads to your storage, records the asset and audits it:

```ts
import type { ImageSink } from "@sahan-sac/blog-kit/images";

export function mediaLibrarySink(actor: Actor): ImageSink {
  return {
    async storeGenerated(image, meta) {
      const saved = await registerGeneratedImage({ ...image, ...meta }, actor); // upload + DB row + audit, in your app
      return saved.ok ? { ok: true, mediaId: saved.asset.id, url: saved.asset.url } : { ok: false, error: saved.error };
    },
  };
}
```

When the sink fails, `generateBlogImage` returns `{ ok: false, stage: "store", image }` with the generated image, so the editor can still show it and offer a download or retry. Image calls are billed. A failed generation returns `stage: "generate"` and never calls the sink.

Tests pass fake providers (`{ providers: [{ name, generate }] }`) and a fake `generate` for images, so nothing touches the network.
