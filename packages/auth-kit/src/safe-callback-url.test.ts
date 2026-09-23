import assert from "node:assert/strict";
import { test } from "node:test";

import { safeCallbackUrl } from "./safe-callback-url";

const ACCEPTED = [
  "/admin",
  "/admin/",
  "/admin/users",
  "/admin/users/42?tab=roles",
  "/admin/blog#top",
  "/admin?x=1",
  "/admin/content/home%20page",
];

const REJECTED = [
  undefined,
  null,
  42,
  {},
  "",
  "admin/users",
  "/",
  "/administrator",
  "/adminx",
  "//evil.example",
  "/admin//evil.example",
  "/admin/\\evil",
  "\\admin",
  "/admin/%2f%2fevil.example",
  "/admin/%5cevil",
  "/admin/..%2f..%2fetc",
  "/admin/../users",
  "/admin/./users",
  "/admin/users\n",
  "/admin/users\r\nSet-Cookie: a=b",
  "/admin/%0d%0a",
  "https://evil.example/admin",
  "javascript:alert(1)",
  "/admin/%zz",
  "/admin/login",
  "/admin/login?callbackUrl=/admin",
  `/admin/${"a".repeat(600)}`,
];

test("same-origin admin paths are kept as given", () => {
  for (const value of ACCEPTED) assert.equal(safeCallbackUrl(value), value, value);
});

test("everything else becomes /admin", () => {
  for (const value of REJECTED) assert.equal(safeCallbackUrl(value), "/admin", String(value));
});

test("the fallback can be chosen", () => {
  assert.equal(safeCallbackUrl("https://evil.example", "/admin/account"), "/admin/account");
});
