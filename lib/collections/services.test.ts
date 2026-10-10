import assert from "node:assert/strict";
import { test } from "node:test";

import { serviceDoneSchema } from "./services";

test("service completion links allow safe site and HTTPS destinations", () => {
  assert.equal(serviceDoneSchema.safeParse({ title: "Delivered", href: "/works", list: [] }).success, true);
  assert.equal(serviceDoneSchema.safeParse({ title: "Delivered", href: "https://example.com", list: [] }).success, true);
});

test("service completion links reject script and protocol-relative URLs", () => {
  for (const href of ["javascript:alert(1)", "data:text/html,x", "//example.com"]) {
    assert.equal(serviceDoneSchema.safeParse({ title: "Delivered", href, list: [] }).success, false, href);
  }
});
