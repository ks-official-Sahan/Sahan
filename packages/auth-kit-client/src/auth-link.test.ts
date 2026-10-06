import assert from "node:assert/strict";
import { test } from "node:test";

import type { ShortLink } from "@sahan-sac/auth-kit/short-link-path";

import { parseAuthLink, type AuthLink } from "./auth-link";

const SITE = "https://example.com";

test("parseAuthLink: auth-kit's short links on the site's origin only", () => {
  assert.deepEqual(parseAuthLink(`${SITE}/a/tok_1`, SITE), { kind: "account", token: "tok_1" });
  assert.deepEqual(parseAuthLink(`${SITE}/e/tok_2`, SITE), { kind: "email", token: "tok_2" });
  assert.deepEqual(parseAuthLink(`${SITE}/s/code/users?q=x`, SITE), { kind: "signIn", code: "code", next: "/admin/users?q=x" });
  assert.equal(parseAuthLink("https://example.com.evil.test/a/tok_1", SITE), null);
  assert.equal(parseAuthLink(`${SITE}/blog/post`, SITE), null);
  assert.equal(parseAuthLink("not a url", SITE), null);
});

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

test("AuthLink stays in step with auth-kit's ShortLink", () => {
  const inStep: Same<ShortLink, AuthLink> = true;
  assert.equal(inStep, true);
});
