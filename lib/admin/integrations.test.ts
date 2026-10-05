import { test, describe, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";

import { generateKeyPairSync } from "node:crypto";

import { resetVertexTokenCache } from "@sahan-sac/ai-core/vertex";

import { checkAnthropic, checkBrevo, checkCloudinary, checkCustomAi, checkOpenAi, checkOpenRouter, checkResend, checkVertex } from "./integrations";

// Fake fetch: no network call, no secret ever leaves the process. Each check
// is exercised for "not configured", "configured and reachable" and
// "configured and unreachable", proving the injectable fetch and the
// configured/reachable split without hitting a real provider.

/** Not a real key: a placeholder the checks must send but never return. */
const FAKE_AI_KEY = "fake-ai-key";

const ENV_KEYS = [
  "RESEND_API_KEY",
  "EMAIL_BREVO_API_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "OPENROUTER_API_KEY",
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_TOKEN_URI",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "AI_CUSTOM_BASE_URL",
  "AI_CUSTOM_MODEL",
  "AI_CUSTOM_API_KEY",
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const okFetch = async () => new Response(null, { status: 200 });
const failFetch = async () => new Response(null, { status: 500 });
const throwingFetch = async () => {
  throw new Error("network down");
};

describe("integration health checks", () => {
  test("resend: not configured returns reachable=null without calling fetch", async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return okFetch();
    };
    const result = await checkResend(fetchImpl);
    assert.equal(result.configured, false);
    assert.equal(result.reachable, null);
    assert.equal(called, false);
  });

  test("resend: configured and reachable", async () => {
    process.env.RESEND_API_KEY = FAKE_AI_KEY;
    const result = await checkResend(okFetch);
    assert.equal(result.configured, true);
    assert.equal(result.reachable, true);
  });

  test("resend: configured but the ping fails", async () => {
    process.env.RESEND_API_KEY = FAKE_AI_KEY;
    const result = await checkResend(failFetch);
    assert.equal(result.configured, true);
    assert.equal(result.reachable, false);
  });

  test("resend: a thrown fetch (timeout, DNS failure) is treated as unreachable, not thrown", async () => {
    process.env.RESEND_API_KEY = FAKE_AI_KEY;
    await assert.doesNotReject(async () => {
      const result = await checkResend(throwingFetch);
      assert.equal(result.reachable, false);
    });
  });

  test("brevo: not configured", async () => {
    const result = await checkBrevo(okFetch);
    assert.equal(result.configured, false);
    assert.equal(result.reachable, null);
  });

  test("brevo: configured and reachable", async () => {
    process.env.EMAIL_BREVO_API_KEY = FAKE_AI_KEY;
    const result = await checkBrevo(okFetch);
    assert.equal(result.configured, true);
    assert.equal(result.reachable, true);
  });

  test("cloudinary: needs all three env vars to count as configured", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    process.env.CLOUDINARY_API_KEY = "key";
    // secret intentionally left unset
    const result = await checkCloudinary(okFetch);
    assert.equal(result.configured, false);
    assert.equal(result.reachable, null);
  });

  test("cloudinary: fully configured and reachable", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = "secret";
    const result = await checkCloudinary(okFetch);
    assert.equal(result.configured, true);
    assert.equal(result.reachable, true);
  });

  test("openrouter: not configured", async () => {
    const result = await checkOpenRouter(okFetch);
    assert.equal(result.configured, false);
    assert.equal(result.reachable, null);
  });

  describe("vertex", () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const configure = () => {
      process.env.GOOGLE_CLIENT_EMAIL = "svc@example.iam.gserviceaccount.com";
      process.env.GOOGLE_PRIVATE_KEY = pem.replace(/\n/g, "\\n");
      process.env.GOOGLE_CLOUD_PROJECT = "demo-project";
    };

    test("not configured without the full service account, and never fetches", async () => {
      process.env.GOOGLE_CLIENT_EMAIL = "svc@example.iam.gserviceaccount.com";
      let called = false;
      const result = await checkVertex(async () => {
        called = true;
        return okFetch();
      });
      assert.equal(result.configured, false);
      assert.equal(result.reachable, null);
      assert.equal(called, false);
      assert.equal(result.name, "Vertex AI");
    });

    test("reachable when Google issues a token", async () => {
      resetVertexTokenCache();
      configure();
      const tokenFetch = async () => Response.json({ access_token: "token", expires_in: 3600 });
      const result = await checkVertex(tokenFetch);
      assert.equal(result.configured, true);
      assert.equal(result.reachable, true);
    });

    test("unreachable when the token exchange is refused", async () => {
      resetVertexTokenCache();
      configure();
      const result = await checkVertex(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
      assert.equal(result.configured, true);
      assert.equal(result.reachable, false);
    });
  });
});

describe("paid AI providers", () => {
  test("OpenAI and Anthropic are checked against their free models lists with the right auth header", async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      seen.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
      return new Response("{}", { status: url.includes("anthropic") ? 200 : 401 });
    };
    assert.deepEqual(await checkOpenAi(fetchImpl), { ...(await checkOpenAi(fetchImpl)), configured: false, reachable: null });
    process.env.OPENAI_API_KEY = FAKE_AI_KEY;
    process.env.OPENAI_BASE_URL = "https://gateway.example/v1/";
    process.env.ANTHROPIC_API_KEY = FAKE_AI_KEY;
    const openai = await checkOpenAi(fetchImpl);
    const anthropic = await checkAnthropic(fetchImpl);
    assert.equal(openai.reachable, false);
    assert.equal(anthropic.reachable, true);
    assert.equal(seen.at(-2)?.url, "https://gateway.example/v1/models");
    assert.equal(seen.at(-1)?.url, "https://api.anthropic.com/v1/models");
    assert.equal(seen.at(-1)?.headers["anthropic-version"], "2023-06-01");
    assert.ok(!JSON.stringify([openai, anthropic]).includes(FAKE_AI_KEY));
  });

  test("a custom endpoint needs a base URL and a model; a local one may have no key", async () => {
    const fetchImpl = async () => new Response("{}", { status: 200 });
    process.env.AI_CUSTOM_BASE_URL = "http://localhost:11434/v1";
    assert.equal((await checkCustomAi(fetchImpl)).configured, false);
    process.env.AI_CUSTOM_MODEL = "llama3.2";
    assert.deepEqual([(await checkCustomAi(fetchImpl)).configured, (await checkCustomAi(fetchImpl)).reachable], [true, true]);
  });
});
