import assert from "node:assert/strict";
import { test } from "node:test";

import { enginesIn, planEngineSwitch, swapCommand } from "./engine-switch";

const files = [
  { path: "lib/auth/engine.ts", text: 'import { createAuthEngine } from "@sahan-sac/auth-kit/engines/next-auth";\n' },
  { path: "lib/auth/session-cookie.ts", text: "import { createSessionCookieCheck } from '@sahan-sac/auth-kit/engines/next-auth/cookie';\n" },
  { path: "lib/other.ts", text: 'import { createAuthorize } from "@sahan-sac/auth-kit";\n' },
];

test("planEngineSwitch rewrites engine and cookie specifiers only, keeping the quotes", () => {
  const plan = planEngineSwitch(files, "better-auth");
  assert.deepEqual(
    plan.map((change) => change.path),
    ["lib/auth/engine.ts", "lib/auth/session-cookie.ts"]
  );
  assert.equal(plan[0].text, 'import { createAuthEngine } from "@sahan-sac/auth-kit/engines/better-auth";\n');
  assert.equal(plan[1].text, "import { createSessionCookieCheck } from '@sahan-sac/auth-kit/engines/better-auth/cookie';\n");
  assert.deepEqual(plan[1].edits, ["@sahan-sac/auth-kit/engines/next-auth/cookie -> @sahan-sac/auth-kit/engines/better-auth/cookie"]);
});

test("planEngineSwitch is empty when already on the engine, and enginesIn reports what is imported", () => {
  assert.deepEqual(planEngineSwitch(files, "next-auth"), []);
  assert.deepEqual(enginesIn(files), ["next-auth"]);
  assert.deepEqual(enginesIn([]), []);
});

test("swapCommand names the right packages for each manager", () => {
  assert.equal(swapCommand("pnpm", "next-auth", "better-auth"), "pnpm remove next-auth && pnpm add better-auth");
  assert.equal(swapCommand("npm", "better-auth", "next-auth"), "npm uninstall better-auth && npm install next-auth@beta");
});
