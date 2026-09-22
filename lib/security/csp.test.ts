import assert from "node:assert/strict";
import { test } from "node:test";

import { LIT_FLAG_SCRIPT, buildCsp, generateNonce, sha256Source } from "./csp";

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
  assert.ok(script.includes(sha256Source(LIT_FLAG_SCRIPT)));
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

test("images and connections are limited to self and Cloudinary", () => {
  const csp = buildCsp({ nonce: "n" });
  assert.equal(directive(csp, "img-src"), "img-src 'self' data: blob: https://res.cloudinary.com");
  assert.equal(directive(csp, "connect-src"), "connect-src 'self' https://api.cloudinary.com");
});

test("nonces are unique, base64 and long enough", () => {
  const first = generateNonce();
  const second = generateNonce();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9+/]{22}==$/);
});

test("the hash source matches a known SHA-256", () => {
  // echo -n "window.litDisableDevMode = true;" | openssl dgst -sha256 -binary | base64
  assert.match(sha256Source(LIT_FLAG_SCRIPT), /^'sha256-[A-Za-z0-9+/]{43}='$/);
  assert.equal(sha256Source("a"), "'sha256-ypeBEsobvcr6wjGzmiPcTaeG7/gUfE5yuYB3ha/uSLs='");
});
