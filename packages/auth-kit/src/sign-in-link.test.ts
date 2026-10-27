import assert from "node:assert/strict";
import { test } from "node:test";

import { verifySignInLink, type UnlockKeys } from "./login-unlock";
import { parseShortLink } from "./short-link-path";
import { prepareSignInLink } from "./sign-in-link";

const keys: UnlockKeys = {
  unlockSecret: "unlock-secret-at-least-32-characters",
  authSecret: "auth-secret-at-least-32-characters-ok",
};

test("prepareSignInLink returns a short path that verifies until it expires", () => {
  const now = Date.parse("2026-10-27T00:00:00Z");
  const link = prepareSignInLink({ now, days: 14, keys, next: "/admin/account" });
  assert.equal(link.days, 14);
  assert.equal(link.expiresAt.toISOString(), new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString());
  const parsed = parseShortLink(link.path, "");
  assert.equal(parsed?.kind, "signIn");
  if (parsed?.kind === "signIn") assert.equal(verifySignInLink(parsed.code, now, keys), true);
});
