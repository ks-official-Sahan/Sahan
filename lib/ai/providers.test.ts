import assert from "node:assert/strict";
import { test } from "node:test";

import { createAiHealth, createAiService, type AiOutcome, type AiProvider } from "./providers";
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

function slowProvider(name: string, ms: number, text = name): AiProvider & { aborted: () => boolean } {
  let aborted = false;
  return {
    name,
    aborted: () => aborted,
    generate: (_prompt, options) =>
      new Promise<AiOutcome>((resolve) => {
        const timer = setTimeout(() => resolve({ ok: true, text }), ms);
        options?.signal?.addEventListener("abort", () => {
          aborted = true;
          clearTimeout(timer);
          resolve({ ok: false, errorClass: "aborted", retryable: true });
        });
      }),
  };
}

test("hedging starts the next provider when the first is slow, and aborts the loser", async () => {
  const slow = slowProvider("slow", 500);
  const fast = slowProvider("fast", 10);
  const service = createAiService({ providers: [slow, fast], hedgeAfterMs: 30 });
  const result = await service.generate(PROMPT);
  assert.equal(result.provider, "fast");
  assert.equal(slow.aborted(), true);
});

test("without hedging, attempts run one at a time in order", async () => {
  const service = createAiService({ providers: [slowProvider("first", 40), slowProvider("second", 1)] });
  const result = await service.generate(PROMPT);
  assert.equal(result.provider, "first");
});

test("a provider that recently failed with 429 is tried after healthy ones", async () => {
  const health = createAiHealth();
  const limited = fakeProvider("limited", { ok: false, errorClass: "http_429", retryable: true, status: 429 });
  const ok = fakeProvider("ok", { ok: true, text: "hi" });
  await createAiService({ providers: [limited, ok], health }).generate(PROMPT);
  const calls: string[] = [];
  const spy = (p: AiProvider): AiProvider => ({ name: p.name, generate: (...args) => (calls.push(p.name), p.generate(...args)) });
  await createAiService({ providers: [spy(limited), spy(ok)], health }).generate(PROMPT);
  assert.deepEqual(calls, ["ok"]);
});

test("the deadline stops the chain before a later provider starts", async () => {
  let now = 0;
  const service = createAiService({
    providers: [fakeProvider("a", { ok: false, errorClass: "http_500", retryable: true, status: 500 }), fakeProvider("b", { ok: true, text: "late" })],
    deadlineMs: 1000,
    now: () => (now += 600),
  });
  const result = await service.generate(PROMPT);
  assert.equal(result.ok, false);
  assert.deepEqual(result.attempts.map((a) => a.provider), ["a"]);
});
