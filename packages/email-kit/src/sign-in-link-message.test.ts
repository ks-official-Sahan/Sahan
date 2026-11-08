import assert from "node:assert/strict";
import { test } from "node:test";

import { COPY_NOTE } from "./layout";
import { signInLinkMessage } from "./sign-in-link-message";

test("the sign-in link email carries the link, and a copy does not", () => {
  const url = "https://valorem.ae/s/abc.def";
  const original = signInLinkMessage({
    brand: "Valorem",
    name: "Ada",
    url,
    validUntil: "10 Nov 2026, 12:00 UTC",
  });
  assert.ok(original.html.includes(url));
  assert.ok(original.text.includes("does not sign you in"));

  const copy = signInLinkMessage({
    brand: "Valorem",
    name: "Ada",
    url,
    validUntil: "10 Nov 2026, 12:00 UTC",
    copy: true,
  });
  assert.equal(copy.subject.startsWith("Copy:"), true);
  assert.ok(!copy.html.includes("/s/abc"));
  assert.ok(copy.text.includes(COPY_NOTE));
});
