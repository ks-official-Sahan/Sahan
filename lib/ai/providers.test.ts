import assert from "node:assert/strict";
import { test } from "node:test";

import { createAiService, type AiOutcome, type AiProvider } from "./providers";
import type { ModelPrompt } from "./guard";

const PROMPT: ModelPrompt = { system: "sys", user: "user" };

function fakeProvider(name: string, outcome: AiOutcome): AiProvider {
  return { name, generate: async () => outcome };
}

test("uses the first provider that succeeds", async () => {
  const service = createAiService({
    providers: [
      fakeProvider("a", { ok: false, errorClass: "http_500", retryable: true }),
      fakeProvider("b", { ok: true, text: "drafted body" }),
      fakeProvider("c", { ok: true, text: "should not be reached" }),
    ],
  });
  const result = await service.generate(PROMPT);
  assert.equal(result.ok, true);
  assert.equal(result.provider, "b");
  assert.equal(result.text, "drafted body");
  assert.deepEqual(
    result.attempts.map((a) => a.provider),
    ["a", "b"]
  );
});

test("stops at a non-retryable failure without trying later providers", async () => {
  const service = createAiService({
    providers: [
      fakeProvider("a", { ok: false, errorClass: "paid_model_blocked", retryable: false }),
      fakeProvider("b", { ok: true, text: "never reached" }),
    ],
  });
  const result = await service.generate(PROMPT);
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.attempts.map((a) => a.provider),
    ["a"]
  );
});

test("an empty provider list fails without attempts", async () => {
  const service = createAiService({ providers: [] });
  const result = await service.generate(PROMPT);
  assert.equal(result.ok, false);
  assert.equal(result.errorClass, "no_provider");
  assert.deepEqual(result.attempts, []);
});

test("a provider that throws is treated as a retryable transport failure", async () => {
  const service = createAiService({
    providers: [
      { name: "throws", generate: async () => { throw new Error("boom"); } },
      fakeProvider("b", { ok: true, text: "ok" }),
    ],
  });
  const result = await service.generate(PROMPT);
  assert.equal(result.ok, true);
  assert.equal(result.provider, "b");
});
