import { strict as assert } from "node:assert";
import { test } from "node:test";

import { accountLinkPath, emailLinkPath, parseShortLink, shortLinkTarget, signInLinkPath } from "./short-links";

const TOKEN = "AAAAAAAAAAAAAAAAAAAAAA.BBBBBBBBBBB";
const CODE = "t1abcd.0123456789abcdef";

test("account and email links round-trip to their landing pages", () => {
  const account = parseShortLink(accountLinkPath(TOKEN));
  assert.deepEqual(account, { kind: "account", token: TOKEN });
  assert.equal(shortLinkTarget({ kind: "account", token: TOKEN }), `/admin/set-password?token=${TOKEN}`);

  const email = parseShortLink(emailLinkPath(TOKEN));
  assert.deepEqual(email, { kind: "email", token: TOKEN });
  assert.equal(shortLinkTarget({ kind: "email", token: TOKEN }), `/admin/confirm-email?token=${TOKEN}`);
});

test("a sign-in link carries its /admin destination in its own path and query", () => {
  assert.equal(signInLinkPath(CODE), `/s/${CODE}`);
  assert.deepEqual(parseShortLink(`/s/${CODE}`), { kind: "signIn", code: CODE, next: "/admin" });
  assert.deepEqual(parseShortLink(`/s/${CODE}/`), { kind: "signIn", code: CODE, next: "/admin" });

  assert.equal(signInLinkPath(CODE, "/admin/leads/abc"), `/s/${CODE}/leads/abc`);
  assert.deepEqual(parseShortLink(`/s/${CODE}/leads/abc`), { kind: "signIn", code: CODE, next: "/admin/leads/abc" });
  assert.deepEqual(parseShortLink(`/s/${CODE}/leads`, "?status=new"), { kind: "signIn", code: CODE, next: "/admin/leads?status=new" });
});

test("a sign-in link never leaves /admin or lands back on the login page", () => {
  assert.equal(signInLinkPath(CODE, "https://evil.example/x"), `/s/${CODE}`);
  assert.equal(signInLinkPath(CODE, "/admin/login"), `/s/${CODE}`);
  for (const rest of ["/login", "//evil.example", "/../api/x", "/%2e%2e/x", "/a\\b"]) {
    const link = parseShortLink(`/s/${CODE}${rest}`);
    assert.equal(link?.kind === "signIn" ? link.next : null, "/admin", rest);
  }
});

test("anything else is not a short link", () => {
  for (const path of ["/a", "/a/", "/a/x/y", "/e/x/y", "/b/x", "/admin/a/x", "/a/has space", `/a/${"x".repeat(129)}`, "/s"]) {
    assert.equal(parseShortLink(path), null, path);
  }
});
