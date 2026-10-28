import assert from "node:assert/strict";
import { test } from "node:test";

import { documentTitle, isIndexableArticle, metaDescription, wordCount } from "./copy";

test("document titles keep the name and stay within 60 characters", () => {
  assert.equal(documentTitle("Sahan Sachintha | Full-Stack Software Engineer"), "Sahan Sachintha | Full-Stack Software Engineer");
  assert.equal(documentTitle("Web and mobile projects"), "Web and mobile projects | Sahan Sachintha");
  const long = documentTitle("Claude Opus 5.5: a leap in AI reasoning and its competitive landscape against older models");
  assert.ok(long.length <= 60, long);
  assert.ok(long.endsWith("| Sahan Sachintha"), long);
  assert.equal(long.includes("  "), false);
});

test("descriptions finish a sentence instead of a hard cut, and short lines name the author", () => {
  const sentence = "Explore Anthropic's Claude Opus 5.5, its advanced reasoning, and capabilities. Detailed comparisons with GPT-4o and Gemini 1.5 Pro, plus the impact on software engineering work.";
  const trimmed = metaDescription(sentence);
  assert.equal(trimmed, "Explore Anthropic's Claude Opus 5.5, its advanced reasoning, and capabilities.");
  assert.ok(!trimmed.includes("GPT-4o"));

  const ready = "Sahan Sachintha is a full-stack software engineer at Datalake Creative, building web and mobile products remotely from Sri Lanka.";
  assert.equal(metaDescription(ready), ready);

  const short = metaDescription("How to connect a Property Finder webhook.");
  assert.ok(short.includes("Sahan Sachintha"));
  assert.ok(short.length <= 160, String(short.length));
});

test("a log line under 300 words is not an indexable article", () => {
  assert.equal(wordCount("one two three"), 3);
  assert.equal(isIndexableArticle("word ".repeat(299)), false);
  assert.equal(isIndexableArticle("word ".repeat(300)), true);
});
