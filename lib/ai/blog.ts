import "server-only";

import { createAiService, realProviders, type AiProvider } from "./providers";
import { buildCoverPrompt, buildDraftPrompt, buildFullPostPrompt, looksLikeLeak } from "./guard";
import { getEnv } from "@/lib/env";

// The two AI helpers behind app/api/admin/ai/{draft,cover}/route.ts
// (docs/plan/admin-cms-adr.md, Step 12). Providers are injected so this module
// is unit tested without a real network call; the routes pass realProviders().

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

export type AiHelperFailure = { ok: false; error: string };

export interface AiDeps {
  providers: readonly AiProvider[];
}

/** The chain built from configured environment keys, for the routes to pass in. */
export function defaultAiDeps(): AiDeps {
  return { providers: realProviders(getEnv()) };
}

export async function draftPost(input: DraftInput, deps: AiDeps): Promise<DraftResult | AiHelperFailure> {
  const prompt = buildDraftPrompt(input);
  const service = createAiService({ providers: deps.providers });
  const result = await service.generate(prompt, { maxTokens: 1400 });

  if (!result.ok || !result.text) {
    return { ok: false, error: "No AI provider is configured or reachable right now." };
  }
  if (looksLikeLeak(result.text)) {
    return { ok: false, error: "The AI response looked unsafe and was discarded. Try a different topic." };
  }
  return { ok: true, html: result.text.trim(), provider: result.provider ?? "unknown" };
}

export async function suggestCover(input: CoverInput, deps: AiDeps): Promise<CoverResult | AiHelperFailure> {
  const prompt = buildCoverPrompt(input);
  const service = createAiService({ providers: deps.providers });
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

export async function generateFullPost(input: FullPostInput, deps: AiDeps): Promise<FullPostResult | AiHelperFailure> {
  const prompt = buildFullPostPrompt(input);
  const service = createAiService({ providers: deps.providers });
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
