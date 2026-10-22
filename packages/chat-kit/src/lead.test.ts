import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rankByQuery, queryTerms } from "./knowledge";
import { extractContact } from "./lead";

describe("extractContact", () => {
  it("finds an email and an international phone", () => {
    assert.deepEqual(extractContact("Call +971 50 888 9477 or mail Me@Example.com"), { email: "me@example.com", phone: "+971508889477" });
  });

  it("normalizes a 00 prefix and a national number", () => {
    assert.equal(extractContact("my number is 00971 4 123 4567").phone, "+97141234567");
    assert.equal(extractContact("050-123-4567").phone, "0501234567");
  });

  it("ignores dates and short numbers", () => {
    assert.deepEqual(extractContact("viewing on 2026-10-22 for 3 beds"), {});
  });

  it("keeps dates and times out of a phone match", () => {
    assert.equal(extractContact("0501234567 2026-10-22").phone, "0501234567");
    assert.deepEqual(extractContact("2026-10-22 10:30"), {});
  });
});

describe("rankByQuery", () => {
  const items = ["Marina 2 bed apartment", "Downtown villa", "Marina penthouse"];

  it("orders by matching terms, keeping input order on ties", () => {
    assert.deepEqual(rankByQuery(items, "penthouse in marina", (s) => s, 2), ["Marina penthouse", "Marina 2 bed apartment"]);
  });

  it("returns the first items when the question has no terms", () => {
    assert.deepEqual(rankByQuery(items, "what is the", (s) => s, 1), ["Marina 2 bed apartment"]);
  });

  it("drops stop words and reads follow-up history", () => {
    assert.deepEqual(queryTerms({ message: "cheaper ones?", history: ["villa in Downtown"] }), ["cheaper", "ones", "villa", "downtown"]);
  });

  it("uses the page path and matches canonically equivalent text", () => {
    assert.deepEqual(queryTerms({ message: "what is this", page: { path: "/pricing" } }), ["pricing"]);
    assert.deepEqual(rankByQuery(["tea", "cafe\u0301 latte"], "café", (s) => s, 1), ["cafe\u0301 latte"]);
  });
});
