import assert from "node:assert/strict";
import { test } from "node:test";

import { BUILTIN_ADAPTERS, chainPlan, checkChain, checkProvider, configuredOrder, providerStatuses, realProviders, type ProviderAdapter } from "./adapters";
import { parseAiEnv, type EnvSource } from "./env";
import type { ModelPrompt } from "./guard";
import { anthropicOutcome, createAiHealth, createAiService, type AiProvider } from "./providers";

/** Not real keys: placeholders the tests look for in requests. */
const FAKE = "fake-key";
const PROMPT: ModelPrompt = { system: "sys", user: "user" };
const env = (source: EnvSource) => parseAiEnv(source);
const names = (providers: AiProvider[]) => providers.map((provider) => provider.name);

test("default order: free providers first; paid ones only with AI_ALLOW_PAID, and then as last resorts", () => {
  const keys = { GEMINI_API_KEY: FAKE, NVIDIA_API_KEY: FAKE, OPENAI_API_KEY: FAKE, ANTHROPIC_API_KEY: FAKE };
  assert.deepEqual(names(realProviders(env(keys), "blog")), ["gemini", "nvidia"]);

  const paid = realProviders(env({ ...keys, AI_ALLOW_PAID: "true" }), "blog");
  assert.deepEqual(names(paid), ["gemini", "nvidia", "openai", "anthropic"]);
  assert.deepEqual(paid.map((provider) => Boolean(provider.lastResort)), [false, false, true, true]);
});

test("explicit order: only the listed providers run, in that order, and paid still needs AI_ALLOW_PAID", () => {
  const keys = { GEMINI_API_KEY: FAKE, NVIDIA_API_KEY: FAKE, DEEPSEEK_API_KEY: FAKE };
  const ordered = realProviders(env({ ...keys, AI_PROVIDER_ORDER: "NVIDIA, gemini, deepseek, nvidia" }), "chat");
  assert.deepEqual(names(ordered), ["nvidia", "gemini"]);
  assert.deepEqual(ordered.map((provider) => provider.priority), [0, 1]);

  const withPaid = realProviders(env({ ...keys, AI_ALLOW_PAID: "1", AI_PROVIDER_ORDER: "deepseek,gemini" }), "chat");
  assert.deepEqual(names(withPaid), ["deepseek", "gemini"]);
  assert.equal(withPaid[0].lastResort, undefined); // the operator's order stands
});

test("a purpose's own order beats the global one", () => {
  const source = { GEMINI_API_KEY: FAKE, NVIDIA_API_KEY: FAKE, AI_PROVIDER_ORDER: "gemini,nvidia", AI_PROVIDER_ORDER_CHAT: "nvidia" };
  assert.deepEqual(configuredOrder(env(source), "chat"), ["nvidia"]);
  assert.deepEqual(configuredOrder(env(source), "blog"), ["gemini", "nvidia"]);
  assert.equal(configuredOrder(env({ AI_PROVIDER_ORDER: " , " }), "blog"), null);
});

test("statuses say why each provider is in or out, naming variables, never values", () => {
  const statuses = providerStatuses(env({ GEMINI_API_KEY: FAKE, XAI_API_KEY: FAKE, AI_PROVIDER_ORDER: "gemini,xai,anthropic,nope" }), "blog");
  const byId = Object.fromEntries(statuses.map((status) => [status.id, status]));
  assert.equal(byId.gemini.state, "active");
  assert.equal(byId.gemini.position, 0);
  assert.equal(byId.xai.state, "needs_paid");
  assert.equal(byId.anthropic.state, "not_configured");
  assert.deepEqual(byId.anthropic.missing, ["ANTHROPIC_API_KEY"]);
  assert.equal(byId.nope.state, "unknown");
  assert.equal(byId.nvidia.state, "not_in_order");
  assert.ok(!JSON.stringify(statuses).includes(FAKE));
});

test("custom endpoint: needs a base URL and model; free only when declared free", () => {
  const custom = { AI_CUSTOM_BASE_URL: "http://localhost:11434/v1", AI_CUSTOM_MODEL: "llama3.2", AI_CUSTOM_NAME: "ollama" };
  assert.deepEqual(names(realProviders(env(custom), "chat")), []);
  assert.deepEqual(names(realProviders(env({ ...custom, AI_CUSTOM_FREE: "true" }), "chat")), ["custom:ollama"]);
  assert.deepEqual(providerStatuses(env({ AI_CUSTOM_MODEL: "x" }), "chat").find((s) => s.id === "custom")?.missing, ["AI_CUSTOM_BASE_URL"]);
});

test("an app adds its own adapter to the registry", () => {
  const mine: ProviderAdapter = {
    id: "mine",
    label: "Mine",
    paid: () => false,
    missing: () => [],
    create: () => ({ name: "mine", generate: async () => ({ ok: true, text: "hi" }) }),
  };
  const adapters = [...BUILTIN_ADAPTERS, mine];
  assert.deepEqual(names(realProviders(env({ GEMINI_API_KEY: FAKE }), "blog", undefined, adapters)), ["gemini", "mine"]);
  assert.deepEqual(chainPlan(env({ AI_PROVIDER_ORDER: "mine" }), "blog", adapters).map((a) => a.id), ["mine"]);
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("the chain passes a request down: OpenAI fails, Anthropic answers", async () => {
  const calls: Array<{ url: string; headers: Record<string, string>; body: Record<string, unknown> }> = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()), body: JSON.parse(String(init?.body)) });
    if (url.startsWith("https://api.openai.com/")) return json(500, { error: { message: "boom" } });
    return json(200, { content: [{ type: "text", text: "from claude" }], stop_reason: "end_turn" });
  }) as typeof fetch;

  const providers = realProviders(
    env({ OPENAI_API_KEY: FAKE, ANTHROPIC_API_KEY: FAKE, AI_ALLOW_PAID: "1", AI_PROVIDER_ORDER: "openai,anthropic", CHAT_ANTHROPIC_MODEL: "claude-test" }),
    "chat",
    fetchImpl
  );
  const result = await createAiService({ providers, logger: { warn: () => undefined } }).generate(PROMPT, { maxTokens: 50 });

  assert.equal(result.ok, true);
  assert.equal(result.provider, "anthropic");
  assert.equal(result.text, "from claude");
  assert.deepEqual(result.attempts.map((a) => [a.provider, a.ok]), [["openai", false], ["anthropic", true]]);

  const claude = calls.find((call) => call.url === "https://api.anthropic.com/v1/messages")!;
  assert.equal(claude.headers["x-api-key"], FAKE);
  assert.equal(claude.headers["anthropic-version"], "2023-06-01");
  assert.deepEqual(claude.body, { model: "claude-test", max_tokens: 50, system: "sys", messages: [{ role: "user", content: "user" }] });
});

test("an operator's order holds even when a later provider is faster; cooling still demotes", async () => {
  const health = createAiHealth();
  health.latencyMs.set("b", 10);
  health.latencyMs.set("a", 900);
  const ok = (name: string): AiProvider => ({ name, generate: async () => ({ ok: true, text: name }) });
  const service = createAiService({ providers: [{ ...ok("a"), priority: 0 }, { ...ok("b"), priority: 1 }], health });
  assert.equal((await service.generate(PROMPT)).provider, "a");

  health.cooldownUntil.set("a", Date.now() + 60_000);
  assert.equal((await service.generate(PROMPT)).provider, "b");
});

test("anthropicOutcome: text blocks joined; truncation, refusal and empty replies fail over", () => {
  assert.deepEqual(anthropicOutcome({ content: [{ type: "thinking" }, { type: "text", text: "a" }, { type: "text", text: "b" }], stop_reason: "end_turn" }), { ok: true, text: "ab" });
  assert.equal((anthropicOutcome({ content: [{ type: "text", text: "a" }], stop_reason: "max_tokens" }) as { errorClass: string }).errorClass, "truncated");
  assert.equal((anthropicOutcome({ stop_reason: "refusal" }) as { errorClass: string }).errorClass, "refused");
  assert.equal((anthropicOutcome({ content: [] }) as { errorClass: string }).errorClass, "empty_response");
});

test("checkProvider: one tiny prompt through one adapter, whatever the order or AI_ALLOW_PAID says", async () => {
  const sent: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    sent.push(String(input));
    return json(200, { content: [{ type: "text", text: "OK" }], stop_reason: "end_turn" });
  }) as typeof fetch;
  const source = env({ ANTHROPIC_API_KEY: FAKE, AI_PROVIDER_ORDER: "gemini" });
  const ok = await checkProvider(source, "anthropic", { fetch: fetchImpl });
  assert.equal(ok.ok, true);
  assert.equal(ok.provider, "anthropic");
  assert.deepEqual(sent, ["https://api.anthropic.com/v1/messages"]);

  assert.equal((await checkProvider(source, "openai")).errorClass, "not_configured");
  assert.equal((await checkProvider(source, "nope")).errorClass, "unknown_provider");
  assert.equal(sent.length, 1); // neither of those made a call
});

test("checkChain: runs the real chain and reports who answered after whom", async () => {
  const fetchImpl = (async (input: string | URL | Request) =>
    String(input).startsWith("https://api.openai.com/")
      ? json(429, { error: { message: "quota" } })
      : json(200, { content: [{ type: "text", text: "OK" }], stop_reason: "end_turn" })) as typeof fetch;
  const result = await checkChain(env({ OPENAI_API_KEY: FAKE, ANTHROPIC_API_KEY: FAKE, AI_ALLOW_PAID: "1", AI_PROVIDER_ORDER_CHAT: "openai,anthropic" }), "chat", { fetch: fetchImpl });
  assert.equal(result.id, "chain:chat");
  assert.equal(result.ok, true);
  assert.equal(result.provider, "anthropic");
  assert.deepEqual(result.attempts, [{ provider: "openai", ok: false, errorClass: "http_429" }, { provider: "anthropic", ok: true }]);

  assert.deepEqual(await checkChain(env({}), "blog"), { id: "chain:blog", ok: false, errorClass: "no_provider", ms: 0, attempts: [] });
});
