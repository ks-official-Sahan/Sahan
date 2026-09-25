import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCsp, generateNonce } from "./csp";

function directive(csp: string, name: string): string {
  const found = csp.split("; ").find((part) => part.startsWith(`${name} `));
  assert.ok(found, `${name} is missing`);
  return found;
}

test("production policy uses the nonce with strict-dynamic and no inline scripts", () => {
  const csp = buildCsp({ nonce: "abc123" });
  const script = directive(csp, "script-src");
  assert.ok(script.includes("'nonce-abc123'"));
  assert.ok(script.includes("'strict-dynamic'"));
  assert.ok(!script.includes("'unsafe-inline'"));
  assert.ok(!script.includes("'unsafe-eval'"));
  // No app-specific inline-script hashes baked into the shared policy.
  assert.ok(!script.includes("'sha256-"));
});

test("the policy locks framing, base, forms and objects", () => {
  const csp = buildCsp({ nonce: "n" });
  assert.equal(directive(csp, "frame-ancestors"), "frame-ancestors 'none'");
  assert.equal(directive(csp, "base-uri"), "base-uri 'self'");
  assert.equal(directive(csp, "form-action"), "form-action 'self'");
  assert.equal(directive(csp, "object-src"), "object-src 'none'");
  assert.equal(directive(csp, "default-src"), "default-src 'self'");
});

test("development adds eval and sockets, production does not", () => {
  const dev = buildCsp({ nonce: "n", dev: true });
  assert.ok(directive(dev, "script-src").includes("'unsafe-eval'"));
  assert.ok(directive(dev, "connect-src").includes("ws:"));
  const prod = buildCsp({ nonce: "n" });
  assert.ok(!prod.includes("ws:"));
});

test("images and connections default to self only, and widen with configured hosts", () => {
  const bare = buildCsp({ nonce: "n" });
  assert.equal(directive(bare, "img-src"), "img-src 'self' data: blob:");
  assert.equal(directive(bare, "connect-src"), "connect-src 'self'");

  const withHosts = buildCsp({ nonce: "n", imgHosts: ["https://res.cloudinary.com"], connectHosts: ["https://api.cloudinary.com"] });
  assert.equal(directive(withHosts, "img-src"), "img-src 'self' data: blob: https://res.cloudinary.com");
  assert.equal(directive(withHosts, "connect-src"), "connect-src 'self' https://api.cloudinary.com");
});

test("style-src keeps unsafe-inline by default and drops it when disabled", () => {
  assert.equal(directive(buildCsp({ nonce: "n" }), "style-src"), "style-src 'self' 'unsafe-inline'");
  assert.equal(directive(buildCsp({ nonce: "n", allowInlineStyles: false }), "style-src"), "style-src 'self'");
});

test("nonces are unique, base64 and long enough", () => {
  const first = generateNonce();
  const second = generateNonce();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9+/]{22}==$/);
});
