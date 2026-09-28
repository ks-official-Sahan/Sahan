import assert from "node:assert/strict";
import { test } from "node:test";

import type { ModelPrompt } from "@sahan-sac/ai-core/guard";
import type { AiLogger } from "@sahan-sac/ai-core/log";
import type { AiOutcome, AiProvider } from "@sahan-sac/ai-core/providers";

import { runChat, type RunChatInput } from "./handler";
import type { ChatSite } from "./types";

const site: ChatSite = {
  author: "Ada",
  authorFullName: "Ada Example",
  role: "Engineer",
  company: "Engineer at Example Ltd",
  location: "Remote",
  tagline: "Ship it",
  email: "ada@example.com",
  phoneDisplay: "+1 555 0100",
  gitHubUrl: "https://github.com/ada",
  siteUrl: "https://ada.example",
  description: "Builds things.",
};

const input: RunChatInput = {
  message: "What have you built?",
  knowledge: "- **Widget** Link: https://widgets.example.org/demo\n",
  config: { tone: "professional" },
  site,
  siteHostname: "ada.example",
  extraHosts: ["wa.me"],
};

const silent: AiLogger = { warn() {} };

function provider(name: string, outcome: AiOutcome, seen?: ModelPrompt[]): AiProvider {
  return {
    name,
    generate: async (prompt) => {
      seen?.push(prompt);
      return outcome;
    },
  };
}

test("runChat wraps the visitor message as data and puts the site identity in the system prompt", async () => {
  const seen: ModelPrompt[] = [];
  const result = await runChat(input, { providers: [provider("fake", { ok: true, text: "Hello" }, seen)], logger: silent });
  assert.equal(result.ok, true);
  assert.equal(seen.length, 1);
  assert.match(seen[0].system, /official portfolio assistant for Ada Example, a Engineer/);
  assert.match(seen[0].system, /Who is Ada\?/);
  assert.match(seen[0].system, /<<<BEGIN_REFERENCE_DATA>>>/);
  assert.notEqual(seen[0].user, input.message);
  assert.ok(seen[0].user.includes(input.message));
});

test("runChat keeps links to the site, the knowledge's hosts and extra hosts, and strips the rest", async () => {
  const text = "See https://ada.example/works, https://widgets.example.org/demo, https://wa.me/1 and https://evil.example/x";
  const result = await runChat(input, { providers: [provider("fake", { ok: true, text })], logger: silent });
  assert.ok(result.ok);
  assert.match(result.text, /https:\/\/ada\.example\/works/);
  assert.match(result.text, /https:\/\/widgets\.example\.org\/demo/);
  assert.match(result.text, /https:\/\/wa\.me\/1/);
  assert.doesNotMatch(result.text, /evil\.example/);
  assert.equal(result.provider, "fake");
  assert.equal(result.tokens, Math.ceil(text.length / 4));
});

test("runChat falls through to the next provider and reports when every provider fails", async () => {
  const fallback = await runChat(input, {
    providers: [provider("down", { ok: false, errorClass: "http_500", retryable: true }), provider("up", { ok: true, text: "Fine" })],
    logger: silent,
  });
  assert.ok(fallback.ok);
  assert.equal(fallback.provider, "up");

  const failed = await runChat(input, { providers: [provider("down", { ok: false, errorClass: "http_500", retryable: false })], logger: silent });
  assert.equal(failed.ok, false);
  assert.ok(!failed.ok && failed.errorClass.length > 0);
});

test("runChat with no providers fails without throwing", async () => {
  const result = await runChat(input, { providers: [], logger: silent });
  assert.deepEqual(result, { ok: false, errorClass: "no_provider" });
});
