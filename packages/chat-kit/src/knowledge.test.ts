import assert from "node:assert/strict";
import { test } from "node:test";

import { buildKnowledge, knowledgeHosts, trainingSection } from "./knowledge";

test("buildKnowledge joins chunks in source order, whatever order they finish in", async () => {
  const slow = { name: "slow", load: () => new Promise<string>((resolve) => setTimeout(() => resolve("A"), 20)) };
  const fast = { name: "fast", load: () => "B" };
  assert.equal(await buildKnowledge([slow, fast]), "AB");
});

test("buildKnowledge skips a failing source and reports it", async () => {
  const errors: string[] = [];
  const text = await buildKnowledge(
    [
      { name: "profile", load: () => "P" },
      { name: "cms", load: async () => { throw new Error("db down"); } },
      { name: "training", load: () => "T" },
    ],
    { onError: (source) => errors.push(source) }
  );
  assert.equal(text, "PT");
  assert.deepEqual(errors, ["cms"]);
});

test("trainingSection is empty without entries", () => {
  assert.equal(trainingSection([]), "");
  assert.equal(trainingSection([{ question: "Q1", answer: "A1" }]), "\n### Training Data\n**Q:** Q1\n**A:** A1\n\n");
});

test("knowledgeHosts lowercases the linked hosts", () => {
  assert.deepEqual(knowledgeHosts("see https://GitHub.com/x and http://a.example.org"), ["github.com", "a.example.org"]);
});
