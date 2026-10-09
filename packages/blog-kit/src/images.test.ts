import assert from "node:assert/strict";
import { test } from "node:test";

import type { ImageConfig } from "@sahan-sac/ai-core/image";

import { generateBlogImage, type ImageSink } from "./images";

const config = { nvidia: { apiKey: "test", model: "test" } } as unknown as ImageConfig;
const options = { alt: "A diagram", folder: "blog", aspectRatio: "16:9" as const };
const png = async () => ({ ok: true as const, base64: "aGVsbG8=", mimeType: "image/png" });

test("a stored image returns its media id and URL, with the alt and folder passed to the sink", async () => {
  const seen: unknown[] = [];
  const sink: ImageSink = {
    async storeGenerated(image, meta) {
      seen.push({ image, meta });
      return { ok: true, mediaId: "m1", url: "https://cdn.example/m1.png" };
    },
  };
  const result = await generateBlogImage("a diagram", options, { config, sink, generate: png });
  assert.deepEqual(result, { ok: true, mediaId: "m1", url: "https://cdn.example/m1.png" });
  assert.deepEqual(seen, [{ image: { base64: "aGVsbG8=", mimeType: "image/png" }, meta: { alt: "A diagram", folder: "blog" } }]);
});

test("a failed store keeps the generated image for the editor's download fallback", async () => {
  const sink: ImageSink = { storeGenerated: async () => ({ ok: false, error: "Upload failed" }) };
  const result = await generateBlogImage("a diagram", options, { config, sink, generate: png });
  assert.deepEqual(result, { ok: false, stage: "store", error: "Upload failed", image: { base64: "aGVsbG8=", mimeType: "image/png" } });
});

test("a failed generation never calls the sink", async () => {
  let called = false;
  const sink: ImageSink = {
    async storeGenerated() {
      called = true;
      return { ok: true, mediaId: "m", url: "u" };
    },
  };
  const result = await generateBlogImage("a diagram", options, {
    config,
    sink,
    generate: async () => ({ ok: false, error: "Image generation timed out." }),
  });
  assert.deepEqual(result, { ok: false, stage: "generate", error: "Image generation timed out." });
  assert.equal(called, false);
});
