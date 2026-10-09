import assert from "node:assert/strict";
import { test } from "node:test";

import { emailEnvSchema, emailProductionProblems } from "./env";
import { MAX_RECIPIENTS } from "./guards";
import { copyRecipients } from "./recipients";

test("copy recipients: valid, unique, never the original recipient, capped", () => {
  assert.deepEqual(copyRecipients(["Boss@Example.com", "boss@example.com", "bad", "user@example.com", " ops@example.com "], ["USER@example.com"]), [
    "Boss@Example.com",
    "ops@example.com",
  ]);
  const many = Array.from({ length: 20 }, (_, index) => `a${index}@example.com`);
  assert.equal(copyRecipients(many, []).length, MAX_RECIPIENTS);
  assert.deepEqual(copyRecipients([], ["x@example.com"]), []);
});

test("env: EMAIL_CC is a comma list, the provider defaults to auto, capture is refused in production", () => {
  const env = emailEnvSchema.parse({ EMAIL_CC: " a@example.com, ,b@example.com ", EMAIL_PORT: "465" });
  assert.deepEqual(env.EMAIL_CC, ["a@example.com", "b@example.com"]);
  assert.equal(env.EMAIL_PROVIDER, "auto");
  assert.equal(env.EMAIL_PORT, 465);
  assert.equal(emailEnvSchema.safeParse({ EMAIL_PORT: "99999" }).success, false);
  assert.deepEqual(emailProductionProblems({ EMAIL_PROVIDER: "capture" }).length, 1);
  assert.deepEqual(emailProductionProblems({ EMAIL_PROVIDER: "auto" }), []);
});
