import assert from "node:assert/strict";
import { test } from "node:test";

import {
  extractJsonObject,
  generateBlogPost,
  generateSeoSuggestion,
  parseBlogGeneration,
} from "./blog-generate";
import type { AiOutcome, AiProvider } from "./providers";
import type { ModelPrompt } from "./guard";

const VALID_POST = {
  title: "Shipping Fast Without Breaking Things",
  excerpt: "A short look at how disciplined engineering teams ship quickly.",
  bodyMarkdown: "## Intro\n\nSome body text.\n\n![a diagram](sahan-ai-image://1 \"Diagram\")\n",
  seoTitle: "Shipping Fast Without Breaking Things",
  seoDescription: "How disciplined engineering teams ship quickly and safely.",
  topic: "Engineering",
  tags: ["engineering", "process"],
  featuredImage: { prompt: "a clean engineering workspace, wide shot", alt: "An engineer's workspace" },
  contentImages: [{ token: "sahan-ai-image://1", prompt: "a system diagram", alt: "System diagram", caption: "How it fits together" }],
};

function fakeProvider(name: string, outcome: AiOutcome): AiProvider {
  return { name, generate: async () => outcome };
}

// ─── extractJsonObject ────────────────────────────────────────────────────

test("extractJsonObject returns a bare JSON object unchanged", () => {
  const text = JSON.stringify({ a: 1 });
  assert.equal(extractJsonObject(text), text);
});

test("extractJsonObject strips a ```json code fence", () => {
  const inner = JSON.stringify({ a: 1 });
  const fenced = `Here you go:\n\`\`\`json\n${inner}\n\`\`\`\nHope that helps.`;
  assert.equal(extractJsonObject(fenced), inner);
});

test("extractJsonObject isolates the outermost braces amid preamble/trailing text", () => {
  const inner = JSON.stringify({ a: 1, b: { c: 2 } });
  const noisy = `Sure, here is the JSON: ${inner} Let me know if you need changes!`;
  assert.equal(extractJsonObject(noisy), inner);
});

test("extractJsonObject returns null when there is no object at all", () => {
  assert.equal(extractJsonObject("no json here"), null);
});

// ─── parseBlogGeneration ──────────────────────────────────────────────────

test("parseBlogGeneration accepts a fully valid post", () => {
  const result = parseBlogGeneration(JSON.stringify(VALID_POST));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.title, VALID_POST.title);
    assert.equal(result.data.contentImages.length, 1);
  }
});

test("parseBlogGeneration accepts the object wrapped in a code fence", () => {
  const result = parseBlogGeneration(`\`\`\`json\n${JSON.stringify(VALID_POST)}\n\`\`\``);
  assert.equal(result.ok, true);
});

test("parseBlogGeneration rejects malformed JSON", () => {
  const result = parseBlogGeneration('{ "title": "missing closing quote, trailing comma, }');
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Invalid JSON/);
});

test("parseBlogGeneration rejects a response with no JSON object", () => {
  const result = parseBlogGeneration("Sorry, I can't help with that.");
  assert.equal(result.ok, false);
});

test("parseBlogGeneration rejects a post missing a required field", () => {
  const { title: _title, ...withoutTitle } = VALID_POST;
  const result = parseBlogGeneration(JSON.stringify(withoutTitle));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /title/);
});

test("parseBlogGeneration rejects an unknown content-image token", () => {
  const bad = { ...VALID_POST, contentImages: [{ ...VALID_POST.contentImages[0], token: "not-a-real-token" }] };
  const result = parseBlogGeneration(JSON.stringify(bad));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Unknown content image token/);
});

test("parseBlogGeneration rejects a duplicate content-image token", () => {
  const image = VALID_POST.contentImages[0];
  const bad = { ...VALID_POST, contentImages: [image, image] };
  const result = parseBlogGeneration(JSON.stringify(bad));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Duplicate content image token/);
});

test("parseBlogGeneration accepts zero content images", () => {
  const bad = { ...VALID_POST, contentImages: [] };
  const result = parseBlogGeneration(JSON.stringify(bad));
  assert.equal(result.ok, true);
});

// ─── generateBlogPost (orchestration, fake providers only) ───────────────

const INPUT = { prompt: "Write about testing", tone: "Professional" as const, length: "Medium" as const };

test("generateBlogPost returns the parsed post on a valid first response", async () => {
  const provider = fakeProvider("fake", { ok: true, text: JSON.stringify(VALID_POST) });
  const result = await generateBlogPost(INPUT, { providers: [provider] });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.post.title, VALID_POST.title);
    assert.equal(result.provider, "fake");
  }
});

test("generateBlogPost repairs once when the first response is invalid JSON, then succeeds", async () => {
  let call = 0;
  const provider: AiProvider = {
    name: "fake",
    generate: async (_prompt: ModelPrompt) => {
      call += 1;
      if (call === 1) return { ok: true, text: "not json at all" };
      return { ok: true, text: JSON.stringify(VALID_POST) };
    },
  };
  const result = await generateBlogPost(INPUT, { providers: [provider] });
  assert.equal(result.ok, true);
  assert.equal(call, 2);
});

test("generateBlogPost fails after the repair attempt also produces invalid JSON", async () => {
  const provider = fakeProvider("fake", { ok: true, text: "still not json" });
  const result = await generateBlogPost(INPUT, { providers: [provider] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /repair/);
});

test("generateBlogPost fails cleanly when no provider is configured", async () => {
  const result = await generateBlogPost(INPUT, { providers: [] });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(typeof result.error, "string");
});

test("generateBlogPost discards a response that looks like a prompt-injection leak", async () => {
  const provider = fakeProvider("fake", { ok: true, text: "<<<SAHAN_USER_DATA_START>>> leaked" });
  const result = await generateBlogPost(INPUT, { providers: [provider] });
  assert.equal(result.ok, false);
});

// ─── generateSeoSuggestion ─────────────────────────────────────────────────

test("generateSeoSuggestion parses a valid SEO suggestion", async () => {
  const payload = { seoTitle: "A great title", seoDescription: "A great description.", excerpt: "A great excerpt." };
  const provider = fakeProvider("fake", { ok: true, text: JSON.stringify(payload) });
  const result = await generateSeoSuggestion({ title: "A great title", contentText: "Some content." }, { providers: [provider] });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.seo.seoTitle, payload.seoTitle);
});

test("generateSeoSuggestion fails on an invalid response", async () => {
  const provider = fakeProvider("fake", { ok: true, text: "{}" });
  const result = await generateSeoSuggestion({ title: "T", contentText: "C" }, { providers: [provider] });
  assert.equal(result.ok, false);
});
