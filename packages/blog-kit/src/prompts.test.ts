import assert from "node:assert/strict";
import { test } from "node:test";

import { buildDraftPrompt } from "./helper-prompts";
import { buildBlogGenerationPrompt, buildSeoSuggestPrompt, contentImageToken } from "./prompts";

const input = { prompt: "Caching", tone: "Technical", length: "Short" } as const;

test("without a site profile the prompts stay neutral: this site, only /, no call-to-action path", () => {
  const { system } = buildBlogGenerationPrompt(input);
  assert.match(system, /complete blog posts for this site\./);
  assert.match(system, /never invent a path beyond this list\): \/\./);
  assert.match(system, /one clear call to action\./);
  assert.doesNotMatch(system, /\{\{/);
  assert.match(buildSeoSuggestPrompt({ title: "t", contentText: "c" }).system, /a blog post on this site\./);
  assert.match(buildDraftPrompt({ topic: "t" }).system, /blog post body for this site\./);
  assert.equal(contentImageToken(0), "ai-image://1");
});

test("a site profile fills the description, the allowed links and the call to action", () => {
  const site = { description: "a bakery's site ($5 loaves)", internalLinks: ["/", "/menu"], callToAction: ["/order"] };
  const { system } = buildBlogGenerationPrompt(input, site);
  assert.match(system, /complete blog posts for a bakery's site \(\$5 loaves\)\./);
  assert.match(system, /beyond this list\): \/, \/menu\./);
  assert.match(system, /call to action, normally linking to \/order\./);
  assert.match(buildDraftPrompt({ topic: "t" }, site).system, /blog post body for a bakery's site/);
});
