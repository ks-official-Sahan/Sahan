import { defineConfig } from "tsup";

// One entry per package.json `exports` subpath, emitted at the same relative
// path under dist/ so publishConfig.exports lines up. ESM only; node: builtins
// and every dependency stay external, never bundled.
export default defineConfig({
  entry: [
    "src/index.ts",
    "src/deps.ts",
    "src/generate.ts",
    "src/helpers.ts",
    "src/prompts.ts",
    "src/helper-prompts.ts",
    "src/images.ts",
    "src/slug.ts",
    "src/markdown.ts",
    "src/chart.ts",
    "src/readtime.ts",
    "src/revisions.ts",
    "src/ai-image-tokens.ts",
    "src/draft.ts",
    "src/concurrency.ts",
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
