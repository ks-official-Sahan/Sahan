import assert from "node:assert/strict";
import { test } from "node:test";

import { htmlToMarkdown, markdownToHtml } from "./markdown";

test("markdownToHtml renders headings, lists and emphasis", () => {
  const html = markdownToHtml("## Heading\n\nSome **bold** and _italic_ text.\n\n- one\n- two\n");
  assert.match(html, /<h2>Heading<\/h2>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<ul>[\s\S]*<li>one<\/li>[\s\S]*<li>two<\/li>[\s\S]*<\/ul>/);
});

test("markdownToHtml downgrades a stray H1 to H2 instead of losing it", () => {
  const html = markdownToHtml("# Should not be H1\n\nbody");
  assert.ok(!/<h1/i.test(html));
  assert.match(html, /<h2>Should not be H1<\/h2>/);
});

test("markdownToHtml renders an image with a caption as title, matching sanitizeRich's allowed img attributes", () => {
  const html = markdownToHtml('![a skyline at dusk](https://example.com/x.png "City skyline")');
  assert.match(html, /<img src="https:\/\/example\.com\/x\.png" alt="a skyline at dusk" title="City skyline">/);
});

test("markdownToHtml renders strikethrough as <s>, not <del>, to match sanitizeRich's allowlist", () => {
  const html = markdownToHtml("~~gone~~");
  assert.match(html, /<s>gone<\/s>/);
  assert.ok(!html.includes("<del>"));
});

test("markdownToHtml renders fenced code blocks as pre>code", () => {
  const html = markdownToHtml("```\nconst x = 1;\n```");
  assert.match(html, /<pre><code[^>]*>const x = 1;\n<\/code><\/pre>/);
});

test("htmlToMarkdown round-trips headings, links and images", () => {
  const html = '<h2>Title</h2><p>Read <a href="https://example.com">this</a>.</p><img src="https://example.com/x.png" alt="alt text" title="a caption">';
  const md = htmlToMarkdown(html);
  assert.match(md, /^## Title/m);
  assert.match(md, /\[this\]\(https:\/\/example\.com\)/);
  assert.match(md, /!\[alt text\]\(https:\/\/example\.com\/x\.png "a caption"\)/);
});

test("htmlToMarkdown renders <s> as GFM strikethrough", () => {
  const md = htmlToMarkdown("<p><s>gone</s></p>");
  assert.match(md, /~~gone~~/);
});

test("markdownToHtml and htmlToMarkdown round-trip a full post body", () => {
  const markdown = [
    "## Section one",
    "",
    "An intro paragraph with **bold** and a [link](https://example.com).",
    "",
    "- first point",
    "- second point",
    "",
    "> A quote worth keeping.",
    "",
    "### Section two",
    "",
    '![a diagram](https://example.com/diagram.png "Diagram caption")',
  ].join("\n");

  const html = markdownToHtml(markdown);
  const roundTripped = htmlToMarkdown(html);
  const roundTrippedHtml = markdownToHtml(roundTripped);

  // Not byte-identical (Markdown has more than one valid rendering of the
  // same HTML), but stable under a second pass: converting the round-tripped
  // Markdown back to HTML must reproduce the same HTML, and the content
  // itself (headings, link, list items, quote, image) must survive.
  assert.equal(roundTrippedHtml, html);
  assert.match(html, /<h2>Section one<\/h2>/);
  assert.match(html, /<h3>Section two<\/h3>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<img src="https:\/\/example\.com\/diagram\.png" alt="a diagram" title="Diagram caption">/);
});

test("empty input converts to an empty string in both directions", () => {
  assert.equal(markdownToHtml(""), "");
  assert.equal(markdownToHtml("   "), "");
  assert.equal(htmlToMarkdown(""), "");
  assert.equal(htmlToMarkdown("   "), "");
});
