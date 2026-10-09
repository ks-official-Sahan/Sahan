import "server-only";

import { createAiService } from "@sahan-sac/ai-core/providers";

import type { AiHelperFailure, BlogAiDeps } from "./deps";
import { buildCoverPrompt, buildDraftPrompt, buildFullPostPrompt, looksLikeLeak } from "./helper-prompts";

/** Whole-chain cap for the draft, cover and full-post helpers: their routes stop at 60 s (Vercel Hobby). */
const HELPER_DEADLINE_MS = 50_000;

// The draft, cover and full-post helpers behind the admin AI routes
// (docs/plan/admin-cms-adr.md, Step 12). Providers are injected so this module
// is unit tested without a real network call; the routes pass realBlogDeps(env).

export interface DraftInput {
  topic: string;
  notes?: string;
}

export interface DraftResult {
  ok: true;
  html: string;
  provider: string;
}

export interface CoverInput {
  topic: string;
}

export interface CoverResult {
  ok: true;
  prompt: string;
  provider: string;
}

export async function draftPost(input: DraftInput, deps: BlogAiDeps): Promise<DraftResult | AiHelperFailure> {
  const prompt = buildDraftPrompt(input, deps.site);
  const service = createAiService({ providers: deps.providers, deadlineMs: HELPER_DEADLINE_MS });
  const result = await service.generate(prompt, { maxTokens: 1400 });

  if (!result.ok || !result.text) {
    return { ok: false, error: "No AI provider is configured or reachable right now." };
  }
  if (looksLikeLeak(result.text)) {
    return { ok: false, error: "The AI response looked unsafe and was discarded. Try a different topic." };
  }
  return { ok: true, html: result.text.trim(), provider: result.provider ?? "unknown" };
}

export async function suggestCover(input: CoverInput, deps: BlogAiDeps): Promise<CoverResult | AiHelperFailure> {
  const prompt = buildCoverPrompt(input, deps.site);
  const service = createAiService({ providers: deps.providers, deadlineMs: HELPER_DEADLINE_MS });
  const result = await service.generate(prompt, { maxTokens: 200 });

  if (!result.ok || !result.text) {
    return { ok: false, error: "No AI provider is configured or reachable right now." };
  }
  if (looksLikeLeak(result.text)) {
    return { ok: false, error: "The AI response looked unsafe and was discarded. Try a different topic." };
  }
  return { ok: true, prompt: result.text.trim(), provider: result.provider ?? "unknown" };
}

// ─── Full post generation ────────────────────────────────────────────────
// Behind app/api/admin/ai/generate-full/route.ts: one call that fills in
// every field the editor form has (title, excerpt, topic, tags, SEO, body),
// instead of the single-field draftPost()/suggestCover() above.

export type FullPostTone = "professional" | "casual" | "technical" | "enthusiastic";
export type FullPostLength = "short" | "medium" | "long";

export interface FullPostInput {
  prompt: string;
  tone: FullPostTone;
  length: FullPostLength;
}

export interface FullPostResult {
  ok: true;
  title: string;
  excerpt: string;
  topic: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  content: string;
  provider: string;
}

/** Strips code fences and any leading/trailing prose, then parses the outermost `{...}`. */
function extractJsonObject(raw: string): Record<string, unknown> | null {
  let cleaned = raw.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function clampText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function clampTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    .slice(0, 20)
    .map((tag) => tag.trim().slice(0, 30));
}

// A JSON-string value can hide a secret-shaped token behind an escape (e.g.
// sk-... decodes to sk-...) that the raw pre-parse text never contains,
// so every field is re-checked here on its *decoded* value, not just the raw
// completion text above.
const FULL_POST_MAX_TOKENS: Record<FullPostLength, number> = {
  short: 1800,
  medium: 2800,
  long: 4000,
};

export async function generateFullPost(input: FullPostInput, deps: BlogAiDeps): Promise<FullPostResult | AiHelperFailure> {
  const prompt = buildFullPostPrompt(input, deps.site);
  const service = createAiService({ providers: deps.providers, deadlineMs: HELPER_DEADLINE_MS });
  const result = await service.generate(prompt, { maxTokens: FULL_POST_MAX_TOKENS[input.length] });

  if (!result.ok || !result.text) {
    return { ok: false, error: "No AI provider is configured or reachable right now." };
  }
  if (looksLikeLeak(result.text)) {
    return { ok: false, error: "The AI response looked unsafe and was discarded. Try a different prompt." };
  }

  const parsed = extractJsonObject(result.text);
  if (!parsed) {
    return { ok: false, error: "The AI response could not be read as a post. Try again." };
  }

  const title = clampText(parsed.title, 200);
  const content = clampText(parsed.content, 200_000);
  if (!title || !content) {
    return { ok: false, error: "The AI response was missing a title or body. Try again." };
  }

  const excerpt = clampText(parsed.excerpt, 500);
  const topic = clampText(parsed.topic, 50);
  const tags = clampTags(parsed.tags);
  const seoTitle = clampText(parsed.seoTitle, 70);
  const seoDescription = clampText(parsed.seoDescription, 200);

  if ([title, content, excerpt, topic, seoTitle, seoDescription, ...tags].some((value) => looksLikeLeak(value))) {
    return { ok: false, error: "The AI response looked unsafe and was discarded. Try a different prompt." };
  }

  return {
    ok: true,
    title,
    content,
    excerpt,
    topic,
    tags,
    seoTitle,
    seoDescription,
    provider: result.provider ?? "unknown",
  };
}
