import assert from "node:assert/strict";
import { test } from "node:test";

import { EmailGuardError } from "./guards";
import { COPY_NOTE, renderEmail, type EmailContent } from "./layout";

const content: EmailContent = {
  preheader: "Pre",
  heading: "You are invited",
  paragraphs: ["Hello <b>there</b>"],
  button: { label: "Accept", url: "https://example.com/a/token" },
  secondaryLink: { label: "Sign in later", url: "https://example.com/s/code", note: "Works 14 days." },
};

test("renders the brand, escapes text, and shows both links", () => {
  const out = renderEmail("Invite", content, { brand: "Site & Co" });
  assert.equal(out.subject, "Invite");
  assert.ok(out.html.includes("Site &amp; Co"));
  assert.ok(out.html.includes("Hello &lt;b&gt;there&lt;/b&gt;"));
  assert.ok(out.html.includes("https://example.com/a/token"));
  assert.ok(out.text.includes("Sign in later: https://example.com/s/code"));
  assert.ok(out.text.endsWith("-- Site & Co"));
});

test("a copy carries no link at all, says why, and is marked in the subject", () => {
  const out = renderEmail("Invite", content, { brand: "Site", copy: true });
  assert.equal(out.subject, "Copy: Invite");
  for (const body of [out.html, out.text]) {
    assert.ok(!body.includes("/a/token"));
    assert.ok(!body.includes("/s/code"));
    assert.ok(body.includes(COPY_NOTE));
  }
});

test("only http(s) links are accepted, in either slot", () => {
  assert.throws(() => renderEmail("x", { ...content, secondaryLink: { label: "x", url: "javascript:alert(1)" } }, { brand: "b" }), EmailGuardError);
  // A copy never renders the link, so it never fails on it either.
  assert.doesNotThrow(() => renderEmail("x", { ...content, button: { label: "x", url: "javascript:1" } }, { brand: "b", copy: true }));
});

test("theme tokens colour the button, link and canvas, and show an https logo", () => {
  const { html } = renderEmail("Invite", content, {
    brand: "Acme",
    theme: { accent: "#0f766e", canvas: "#ecfeff", logoUrl: "https://cdn.example.com/logo.png" },
  });
  assert.match(html, /background:#0f766e;color:#ffffff/);
  assert.match(html, /color:#0f766e;word-break:break-all/);
  assert.match(html, /background:#ecfeff;/);
  assert.match(html, /<img src="https:\/\/cdn\.example\.com\/logo\.png" alt="Acme"/);
});

test("invalid theme tokens fall back to the neutral layout instead of reaching the HTML", () => {
  const { html } = renderEmail("Invite", content, {
    brand: "Acme",
    theme: { accent: "red;background:url(x)", canvas: "#fff", logoUrl: "http://cdn.example.com/logo.png" },
  });
  assert.match(html, /background:#18181b;color:#ffffff/);
  assert.match(html, /background:#f4f4f5;/);
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /url\(x\)/);
});

test("without a theme the output is unchanged", () => {
  assert.equal(
    renderEmail("Invite", content, { brand: "Acme" }).html,
    renderEmail("Invite", content, { brand: "Acme", theme: {} }).html
  );
});
