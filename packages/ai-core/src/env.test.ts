import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_GOOGLE_TOKEN_URI, parseAiEnv } from "./env";

test("feature switches: blog AI off and chatbot on by default", () => {
  const env = parseAiEnv({});
  assert.equal(env.ENABLE_BLOG_AI, false);
  assert.equal(env.ENABLE_CHATBOT, true);
  assert.equal(env.AI_ALLOW_PAID, false);
});

test("ENABLE_CHATBOT turns off only with an explicit off value", () => {
  for (const off of ["false", "0", "no", "off", "OFF"]) {
    assert.equal(parseAiEnv({ ENABLE_CHATBOT: off }).ENABLE_CHATBOT, false, off);
  }
  for (const on of ["", "  ", "true", "1", "yes", "on"]) {
    assert.equal(parseAiEnv({ ENABLE_CHATBOT: on }).ENABLE_CHATBOT, true, JSON.stringify(on));
  }
});

test("ENABLE_BLOG_AI needs an explicit on value", () => {
  assert.equal(parseAiEnv({ ENABLE_BLOG_AI: "true" }).ENABLE_BLOG_AI, true);
  assert.equal(parseAiEnv({ ENABLE_BLOG_AI: "maybe" }).ENABLE_BLOG_AI, false);
});

test("blank keys read as unset; the private key's literal \\n become newlines", () => {
  const env = parseAiEnv({ GEMINI_API_KEY: "   ", GOOGLE_PRIVATE_KEY: "-----BEGIN-----\\nabc\\n-----END-----" });
  assert.equal(env.GEMINI_API_KEY, undefined);
  assert.equal(env.GOOGLE_PRIVATE_KEY, "-----BEGIN-----\nabc\n-----END-----");
});

test("GOOGLE_TOKEN_URI defaults to Google's token endpoint", () => {
  assert.equal(parseAiEnv({}).GOOGLE_TOKEN_URI, DEFAULT_GOOGLE_TOKEN_URI);
  assert.equal(parseAiEnv({ GOOGLE_TOKEN_URI: "https://example.test/token" }).GOOGLE_TOKEN_URI, "https://example.test/token");
});
