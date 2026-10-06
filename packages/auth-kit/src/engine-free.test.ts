import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// An app installs one engine. Every entry point except the engine's own must
// load without the other one, so no module reachable from them may import
// `next-auth` or `better-auth` (type-only imports are erased, so they pass).

const SRC = dirname(fileURLToPath(import.meta.url));
const ENGINE = /^(next-auth|better-auth|@auth\/core)(\/|$)/;
const ENGINE_ENTRIES = new Set(["config.ts", "next-auth-engine.ts", "better-auth/index.ts"]);
const IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm;

function resolveLocal(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, resolve(base, "index.ts")]) {
    if (candidate.endsWith(".ts") && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Engine packages imported at runtime anywhere in `entry`'s local import graph. */
function engineImports(entry: string): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const [, spec] of readFileSync(file, "utf8").matchAll(IMPORT)) {
      if (ENGINE.test(spec)) found.push(`${file.slice(SRC.length + 1)} -> ${spec}`);
      else if (spec.startsWith(".")) {
        const next = resolveLocal(file, spec);
        if (next) walk(next);
      }
    }
  };
  walk(resolve(SRC, entry));
  return found;
}

const exportsMap = JSON.parse(readFileSync(resolve(SRC, "../package.json"), "utf8")).exports as Record<string, string>;
const entries = Object.values(exportsMap)
  .filter((path) => path.startsWith("./src/") && path.endsWith(".ts"))
  .map((path) => path.slice("./src/".length))
  .filter((path) => !ENGINE_ENTRIES.has(path));

test("only the engine subpaths import an auth engine", () => {
  assert.ok(entries.includes("index.ts"));
  // The walker must see an engine where one is: otherwise every check below passes vacuously.
  assert.ok(engineImports("config.ts").length > 0 && engineImports("better-auth/index.ts").length > 0);
  for (const entry of entries) assert.deepEqual(engineImports(entry), [], entry);
});
