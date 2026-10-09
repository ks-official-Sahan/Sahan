import assert from "node:assert/strict";
import { test } from "node:test";

import { blogAiEnabled, blogAiImagesEnabled, chatbotEnabled, textAiConfigured } from "./availability";
import { parseAiEnv } from "./env";

const vertex = {
  GOOGLE_CLIENT_EMAIL: "svc@example.iam.gserviceaccount.com",
  GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
  GOOGLE_CLOUD_PROJECT: "project",
};

test("blog AI is off by default, even with a provider key", () => {
  assert.equal(blogAiEnabled(parseAiEnv({ GEMINI_API_KEY: "key" })), false);
});

test("blog AI needs ENABLE_BLOG_AI and a text provider", () => {
  assert.equal(blogAiEnabled(parseAiEnv({ ENABLE_BLOG_AI: "true" })), false);
  assert.equal(blogAiEnabled(parseAiEnv({ ENABLE_BLOG_AI: "true", OPENROUTER_API_KEY_2: "key" })), true);
});

test("Vertex counts as a text provider only with AI_ALLOW_PAID", () => {
  assert.equal(textAiConfigured(parseAiEnv(vertex)), false);
  assert.equal(textAiConfigured(parseAiEnv({ ...vertex, AI_ALLOW_PAID: "true" })), true);
});

test("blog AI images need an image provider as well", () => {
  assert.equal(blogAiImagesEnabled(parseAiEnv({ ENABLE_BLOG_AI: "true", GEMINI_API_KEY: "key" })), false);
  assert.equal(blogAiImagesEnabled(parseAiEnv({ ENABLE_BLOG_AI: "true", GEMINI_API_KEY: "key", NVIDIA_API_KEY: "key" })), true);
});

test("chatbot is on by default with a provider key, and ENABLE_CHATBOT=false turns it off", () => {
  assert.equal(chatbotEnabled(parseAiEnv({})), false);
  assert.equal(chatbotEnabled(parseAiEnv({ NVIDIA_API_KEY: "key" })), true);
  assert.equal(chatbotEnabled(parseAiEnv({ NVIDIA_API_KEY: "key", ENABLE_CHATBOT: "false" })), false);
});
