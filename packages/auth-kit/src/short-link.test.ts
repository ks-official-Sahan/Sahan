import assert from "node:assert/strict";
import { test } from "node:test";

import { createToken } from "./invite-token";
import { signSignInLink, type UnlockKeys } from "./login-unlock";
import {
  accountLinkPath,
  emailLinkPath,
  parseShortLink,
  resolveShortLink,
  shortLinkTarget,
  signInLinkPath,
  type ShortLinkDeps,
} from "./short-link";

const TOKEN = "AAAAAAAAAAAAAAAAAAAAAA.BBBBBBBBBBB";
const CODE = "t1abcd.0123456789abcdef";
const SECRET = "test-auth-secret-0123456789-abcdefghijklmnop";
const keys: UnlockKeys = { authSecret: SECRET, unlockSecret: "test-unlock-secret" };
const NOW = 1_800_000_000_000;
const deps = (overrides: Partial<ShortLinkDeps> = {}): ShortLinkDeps => ({
  authSecret: SECRET,
  unlockGate: true,
  keys,
  now: NOW,
  ...overrides,
});

test("account and email links round-trip to their landing pages", () => {
  assert.deepEqual(parseShortLink(accountLinkPath(TOKEN)), { kind: "account", token: TOKEN });
  assert.equal(shortLinkTarget({ kind: "account", token: TOKEN }), `/admin/set-password?token=${TOKEN}`);
  assert.deepEqual(parseShortLink(emailLinkPath(TOKEN)), { kind: "email", token: TOKEN });
  assert.equal(shortLinkTarget({ kind: "email", token: TOKEN }), `/admin/confirm-email?token=${TOKEN}`);
  assert.equal(
    shortLinkTarget({ kind: "account", token: TOKEN }, { setPassword: "/app/welcome", confirmEmail: "/app/confirm" }),
    `/app/welcome?token=${TOKEN}`
  );
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

test("resolveShortLink: a real token redirects, a forged one is locked", async () => {
  const { token } = createToken(SECRET);
  assert.deepEqual(await resolveShortLink({ kind: "account", token }, deps()), {
    kind: "redirect",
    location: `/admin/set-password?token=${token}`,
    unlock: false,
  });
  assert.deepEqual(await resolveShortLink({ kind: "email", token: TOKEN }, deps()), { kind: "locked", reason: "bad_token" });
});

test("resolveShortLink: a sign-in link unlocks only when signed, unexpired and within the rate limit", async () => {
  const code = signSignInLink(NOW, 14, keys);
  const link = { kind: "signIn" as const, code, next: "/admin/leads" };
  assert.deepEqual(await resolveShortLink(link, deps()), { kind: "redirect", location: "/admin/leads", unlock: true });
  assert.deepEqual(await resolveShortLink({ ...link, code: CODE }, deps()), { kind: "locked", reason: "bad_code" });
  assert.deepEqual(await resolveShortLink(link, deps({ rateLimit: async () => false })), { kind: "locked", reason: "rate_limited" });
  assert.deepEqual(await resolveShortLink(link, deps({ keys: null })), { kind: "locked", reason: "not_configured" });
  // Gate off: the login page is public, so the link is a plain redirect with no cookie.
  assert.deepEqual(await resolveShortLink({ ...link, code: CODE }, deps({ unlockGate: false })), {
    kind: "redirect",
    location: "/admin/leads",
    unlock: false,
  });
});
