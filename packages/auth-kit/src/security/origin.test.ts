import assert from "node:assert/strict";
import { test } from "node:test";

import { isAllowedOrigin } from "./origin";

const context = {
  hosts: ["sahansachintha.com", null],
  siteUrl: "https://sahansachintha.com",
  extraOrigins: ["https://preview.example.vercel.app"],
};

test("the request host, the site URL and the extra origins are allowed", () => {
  assert.equal(isAllowedOrigin("https://sahansachintha.com", context), true);
  assert.equal(isAllowedOrigin("https://SahanSachintha.com", context), true);
  assert.equal(isAllowedOrigin("https://preview.example.vercel.app", context), true);
  assert.equal(isAllowedOrigin("http://localhost:3000", { hosts: ["localhost:3000"] }), true);
});

test("a missing, null or foreign origin is refused", () => {
  for (const origin of [undefined, null, "", "null", "https://evil.example", "https://sahansachintha.com.evil.example", "https://evil.example/https://sahansachintha.com", "not a url", "ftp://sahansachintha.com", "javascript:alert(1)"]) {
    assert.equal(isAllowedOrigin(origin, context), false, String(origin));
  }
});

test("ports matter", () => {
  assert.equal(isAllowedOrigin("http://localhost:4000", { hosts: ["localhost:3000"] }), false);
});

test("a forwarded host list uses its first entry", () => {
  assert.equal(isAllowedOrigin("https://a.example", { hosts: ["a.example, b.example"] }), true);
  assert.equal(isAllowedOrigin("https://b.example", { hosts: ["a.example, b.example"] }), false);
});

test("nothing is allowed by an empty context", () => {
  assert.equal(isAllowedOrigin("https://sahansachintha.com", { hosts: [] }), false);
});
