import assert from "node:assert/strict";
import { test } from "node:test";

import { applyImageToken, applyImageTokenToHtml } from "./ai-image-tokens";

const TOKEN = "ai-image://1";

test("applyImageToken replaces the token with the real URL on success", () => {
  const markdown = `Intro.\n\n![a diagram](${TOKEN} "How it fits together")\n\nMore text.`;
  const result = applyImageToken(markdown, TOKEN, { url: "https://cdn.example.com/x.png", alt: "a diagram" });
  assert.equal(result, `Intro.\n\n![a diagram](https://cdn.example.com/x.png "How it fits together")\n\nMore text.`);
});

test("applyImageToken replaces the whole image line with a placeholder note when resolved is null", () => {
  const markdown = `Intro.\n\n![a diagram](${TOKEN} "How it fits together")\n\nMore text.`;
  const result = applyImageToken(markdown, TOKEN, null);
  assert.ok(!result.includes(TOKEN));
  assert.ok(!result.includes("!["));
  assert.match(result, /Add an image here — a diagram/);
  assert.ok(result.startsWith("Intro."));
  assert.ok(result.endsWith("More text."));
});

test("applyImageToken leaves markdown unchanged when the token is not present", () => {
  const markdown = "No images here.";
  assert.equal(applyImageToken(markdown, TOKEN, { url: "https://x", alt: "x" }), markdown);
  assert.equal(applyImageToken(markdown, TOKEN, null), markdown);
});

test("applyImageToken only touches the matching token, not a different one", () => {
  const markdown = `![first](ai-image://1 "a")\n\n![second](ai-image://2 "b")`;
  const result = applyImageToken(markdown, "ai-image://1", { url: "https://cdn.example.com/1.png", alt: "first" });
  assert.match(result, /!\[first\]\(https:\/\/cdn\.example\.com\/1\.png "a"\)/);
  assert.match(result, /!\[second\]\(ai-image:\/\/2 "b"\)/);
});

test("applyImageToken handles a placeholder image with no caption", () => {
  const markdown = `![alt only](${TOKEN})`;
  const success = applyImageToken(markdown, TOKEN, { url: "https://cdn.example.com/x.png", alt: "alt only" });
  assert.equal(success, "![alt only](https://cdn.example.com/x.png)");

  const failure = applyImageToken(markdown, TOKEN, null);
  assert.match(failure, /Add an image here — alt only/);
});

test("applyImageTokenToHtml swaps the token src for the real URL and keeps the rest of the body", () => {
  const html = `<h2>Edited heading</h2><figure><img src="${TOKEN}" alt="a diagram"><figcaption>Fits</figcaption></figure><p>typed while waiting</p>`;
  const result = applyImageTokenToHtml(html, TOKEN, { url: "https://cdn.example.com/x.png?a=1&b=2", alt: "a diagram" });
  assert.equal(
    result,
    '<h2>Edited heading</h2><figure><img src="https://cdn.example.com/x.png?a=1&amp;b=2" alt="a diagram"><figcaption>Fits</figcaption></figure><p>typed while waiting</p>'
  );
});

test("applyImageTokenToHtml replaces a failed figure or bare img with a placeholder note", () => {
  const figure = `<p>a</p><figure><img src="${TOKEN}" alt="Diagram"><figcaption>Cap</figcaption></figure><p>b</p>`;
  assert.equal(
    applyImageTokenToHtml(figure, TOKEN, null),
    '<p>a</p><p><em>(Add an image here — Diagram. Use "Choose from library" or the AI Image Prompt to fill it in.)</em></p><p>b</p>'
  );
  const bare = `<figure><img src="https://cdn.example.com/kept.png" alt="kept"><figcaption>k</figcaption></figure><img src="${TOKEN}" alt="Bare"><p>Cap</p>`;
  const result = applyImageTokenToHtml(bare, TOKEN, null);
  assert.match(result, /kept\.png/);
  assert.match(result, /Add an image here — Bare\./);
  assert.doesNotMatch(result, /ai-image:/);
});

test("applyImageTokenToHtml leaves a body without the token unchanged", () => {
  const html = "<p>ai-image://1 as text is not an image</p>";
  assert.equal(applyImageTokenToHtml(html, TOKEN, null), html);
});
