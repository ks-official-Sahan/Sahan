import assert from "node:assert/strict";
import { test } from "node:test";

import { generateFullPost } from "./blog";
import type { AiOutcome, AiProvider } from "./providers";

function fakeProvider(name: string, outcome: AiOutcome): AiProvider {
  return { name, generate: async () => outcome };
}

const VALID_JSON = JSON.stringify({
  title: "Debugging Node.js Memory Leaks",
  excerpt: "A quick tour of finding and fixing leaks in long-running services.",
  topic: "engineering",
  tags: ["node", "performance", "debugging"],
  seoTitle: "Debugging Node.js Memory Leaks",
  seoDescription: "How to find and fix memory leaks in Node.js services.",
  content: "<p>Start with a heap snapshot.</p>",
});

test("generateFullPost parses a clean JSON reply into every editor field", async () => {
  const result = await generateFullPost(
    { prompt: "memory leaks in node", tone: "technical", length: "medium" },
    { providers: [fakeProvider("fake", { ok: true, text: VALID_JSON })] }
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.title, "Debugging Node.js Memory Leaks");
  assert.equal(result.content, "<p>Start with a heap snapshot.</p>");
  assert.deepEqual(result.tags, ["node", "performance", "debugging"]);
  assert.equal(result.provider, "fake");
});

test("generateFullPost strips markdown code fences and leading prose around the JSON", async () => {
  const wrapped = `Sure, here you go:\n\`\`\`json\n${VALID_JSON}\n\`\`\``;
  const result = await generateFullPost(
    { prompt: "x", tone: "professional", length: "short" },
    { providers: [fakeProvider("fake", { ok: true, text: wrapped })] }
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.title, "Debugging Node.js Memory Leaks");
});

test("generateFullPost fails when no provider is configured", async () => {
  const result = await generateFullPost(
    { prompt: "x", tone: "professional", length: "short" },
    { providers: [] }
  );
  assert.equal(result.ok, false);
});

test("generateFullPost fails on a reply that is not JSON", async () => {
  const result = await generateFullPost(
    { prompt: "x", tone: "professional", length: "short" },
    { providers: [fakeProvider("fake", { ok: true, text: "not json at all" })] }
  );
  assert.equal(result.ok, false);
});

test("generateFullPost fails when the JSON is missing a title or body", async () => {
  const result = await generateFullPost(
    { prompt: "x", tone: "professional", length: "short" },
    { providers: [fakeProvider("fake", { ok: true, text: JSON.stringify({ excerpt: "no title or content" }) })] }
  );
  assert.equal(result.ok, false);
});

test("generateFullPost clamps oversized fields to the schema's limits", async () => {
  const oversized = JSON.stringify({
    title: "T".repeat(500),
    content: "<p>ok</p>",
    tags: Array.from({ length: 30 }, (_, i) => `tag-${i}`),
    seoTitle: "S".repeat(200),
  });
  const result = await generateFullPost(
    { prompt: "x", tone: "professional", length: "short" },
    { providers: [fakeProvider("fake", { ok: true, text: oversized })] }
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.title.length, 200);
  assert.equal(result.seoTitle.length, 70);
  assert.equal(result.tags.length, 20);
});

test("generateFullPost discards a reply that looks like a leaked secret", async () => {
  const leaky = JSON.stringify({ title: "leak sk-abcdefghij1234567890", content: "<p>x</p>" });
  const result = await generateFullPost(
    { prompt: "x", tone: "professional", length: "short" },
    { providers: [fakeProvider("fake", { ok: true, text: leaky })] }
  );
  assert.equal(result.ok, false);
});
