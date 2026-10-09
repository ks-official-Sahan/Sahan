import { defineConfig } from "tsup";

// One entry per package.json `exports` subpath, emitted at the same relative
// path under dist/ so publishConfig.exports lines up. ESM only; node: builtins
// and every dependency stay external, never bundled.
export default defineConfig({
  entry: [
    "src/index.ts",
    "src/types.ts",
    "src/adapter.ts",
    "src/prompts.ts",
    "src/guard.ts",
    "src/visitor-cookie.ts",
    "src/knowledge.ts",
    "src/handler.ts",
    "src/session-summaries.ts",
  ],
  format: ["esm"],
  dts: { resolve: false },
  tsconfig: "tsconfig.build.json",
  outDir: "dist",
  // Shared modules go to chunks, so every subpath sees one copy of each class
  // and module-level state (instanceof and caches work across subpaths).
  splitting: true,
  sourcemap: false,
  clean: true,
  target: "es2022",
  platform: "node",
  external: ["next","react"],
  skipNodeModulesBundle: true,
});
