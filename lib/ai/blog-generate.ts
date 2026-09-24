import "server-only";

import { z } from "zod";

import { looksLikeLeak } from "./guard";
import { buildBlogGenerationPrompt, buildRepairPrompt, buildSeoSuggestPrompt, contentImageToken, type BlogGenerationInput } from "./blog-prompts";
import { createAiService, realProviders, sharedAiHealth, type AiProvider } from "./providers";
import { getEnv } from "@/lib/env";

// Full blog-post generation (AGENTS.md "AI blog" feature). Providers are
// injected so this module is unit tested without a network call; the route
// handler passes defaultAiDeps(). Budgets follow the task's guidance:
// generous per-attempt and whole-chain timeouts with a hedge, since a full
// post is a much bigger generation than the existing draft/cover helpers.

const contentImageSchema = z.object({
  token: z.string().min(1).max(64),
  prompt: z.string().trim().min(1).max(500),
  alt: z.string().trim().min(1).max(200),
  caption: z.string().trim().max(200).optional(),
});

export const blogGenerationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().min(1).max(500),
  bodyMarkdown: z.string().trim().min(1).max(50_000),
  seoTitle: z.string().trim().min(1).max(70),
  seoDescription: z.string().trim().min(1).max(200),
  topic: z.string().trim().min(1).max(50),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  featuredImage: z.object({
    prompt: z.string().trim().min(1).max(500),
    alt: z.string().trim().min(1).max(200),
  }),
  contentImages: z.array(contentImageSchema).max(3).default([]),
});

export type BlogGeneration = z.infer<typeof blogGenerationSchema>;

export const seoSuggestionSchema = z.object({
  seoTitle: z.string().trim().min(1).max(70),
  seoDescription: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().min(1).max(500),
});

export type SeoSuggestion = z.infer<typeof seoSuggestionSchema>;

export type AiHelperFailure = { ok: false; error: string };

export interface AiDeps {
  providers: readonly AiProvider[];
}

/** The chain built from configured environment keys, for the routes to pass in. */
export function defaultAiDeps(): AiDeps {
  return { providers: realProviders(getEnv()) };
}

/** Generous budgets for a full post (title + body + SEO + image prompts), per the task's guidance. */
const GENERATION_BUDGETS = { timeoutMs: 45_000, deadlineMs: 90_000, hedgeAfterMs: 15_000 } as const;
const GENERATION_MAX_TOKENS = 3500;

/** Strips a ```json ... ``` (or bare ```) fence and isolates the outermost {...} object. */
export function extractJsonObject(text: string): string | null {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return candidate.slice(start, end + 1);
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

function parseJsonWith<T>(text: string, schema: z.ZodType<T>): ParseResult<T> {
  const jsonText = extractJsonObject(text);
  if (!jsonText) return { ok: false, error: "No JSON object found in the response." };

  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${error instanceof Error ? error.message : "parse failed"}` };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    return { ok: false, error: `Response did not match the expected shape: ${issues.join("; ")}` };
  }
  return { ok: true, data: parsed.data };
}

/** Exported for unit tests; also used internally by generateBlogPost(). */
export function parseBlogGeneration(text: string): ParseResult<BlogGeneration> {
  const result = parseJsonWith(text, blogGenerationSchema);
  if (!result.ok) return result;

  // Every token referenced by contentImages must be one of the offered
  // placeholders and unique, so the caller can safely string-replace them
  // in bodyMarkdown once each image is generated.
  const offered = new Set(Array.from({ length: 3 }, (_, i) => contentImageToken(i)));
  const seen = new Set<string>();
  for (const image of result.data.contentImages) {
    if (!offered.has(image.token)) return { ok: false, error: `Unknown content image token: ${image.token}` };
    if (seen.has(image.token)) return { ok: false, error: `Duplicate content image token: ${image.token}` };
    seen.add(image.token);
  }
  return result;
}

export interface GenerateBlogPostResult {
  ok: true;
  post: BlogGeneration;
  provider: string;
}

/**
 * Generates a full post as validated JSON. Retries once with a repair
 * prompt (asking the model to fix its own malformed reply) if the first
 * response fails to parse or validate — never more than once, so a model
 * that cannot produce valid JSON fails fast rather than looping.
 */
export async function generateBlogPost(input: BlogGenerationInput, deps: AiDeps): Promise<GenerateBlogPostResult | AiHelperFailure> {
  const service = createAiService({ providers: deps.providers, health: sharedAiHealth, ...GENERATION_BUDGETS });

  const first = await service.generate(buildBlogGenerationPrompt(input), { maxTokens: GENERATION_MAX_TOKENS });
  if (!first.ok || !first.text) {
    return { ok: false, error: "No AI provider is configured or reachable right now." };
  }
  if (looksLikeLeak(first.text)) {
    return { ok: false, error: "The AI response looked unsafe and was discarded. Try a different brief." };
  }

  const firstParsed = parseBlogGeneration(first.text);
  if (firstParsed.ok) {
    return { ok: true, post: firstParsed.data, provider: first.provider ?? "unknown" };
  }

  const repair = await service.generate(buildRepairPrompt(input, first.text, firstParsed.error), { maxTokens: GENERATION_MAX_TOKENS });
  if (!repair.ok || !repair.text) {
    return { ok: false, error: `The AI response could not be parsed (${firstParsed.error}), and the repair attempt failed too.` };
  }
  if (looksLikeLeak(repair.text)) {
    return { ok: false, error: "The AI response looked unsafe and was discarded. Try a different brief." };
  }

  const repairedParsed = parseBlogGeneration(repair.text);
  if (!repairedParsed.ok) {
    return { ok: false, error: `The AI could not produce a valid post after one repair attempt (${repairedParsed.error}).` };
  }
  return { ok: true, post: repairedParsed.data, provider: repair.provider ?? "unknown" };
}

export interface GenerateSeoResult {
  ok: true;
  seo: SeoSuggestion;
  provider: string;
}

export async function generateSeoSuggestion(input: { title: string; contentText: string }, deps: AiDeps): Promise<GenerateSeoResult | AiHelperFailure> {
  const service = createAiService({ providers: deps.providers, health: sharedAiHealth, timeoutMs: 25_000, deadlineMs: 45_000 });
  const result = await service.generate(buildSeoSuggestPrompt(input), { maxTokens: 400 });
  if (!result.ok || !result.text) {
    return { ok: false, error: "No AI provider is configured or reachable right now." };
  }
  if (looksLikeLeak(result.text)) {
    return { ok: false, error: "The AI response looked unsafe and was discarded." };
  }
  const parsed = parseJsonWith(result.text, seoSuggestionSchema);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, seo: parsed.data, provider: result.provider ?? "unknown" };
}
