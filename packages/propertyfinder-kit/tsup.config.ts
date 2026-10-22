import { defineConfig } from "tsup";

// One entry per package.json `exports` subpath, emitted at the same relative
// path under dist/ so publishConfig.exports lines up. ESM only; no runtime
// dependencies, so nothing is bundled from node_modules.
export default defineConfig({
  entry: [
    "src/index.ts",
    "src/cache.ts",
    "src/types.ts",
    "src/leads-types.ts",
    "src/listing-content.ts",
    "src/location.ts",
    "src/location-format.ts",
    "src/related.ts",
    "src/webhook-payload.ts",
    "src/transform.ts",
    "src/client.ts",
  ],
  format: ["esm"],
  dts: { resolve: false },
  tsconfig: "tsconfig.build.json",
  outDir: "dist",
  // Shared modules go to chunks, so every subpath sees one copy of each module.
  splitting: true,
  sourcemap: false,
  clean: true,
  target: "es2022",
  platform: "neutral",
  skipNodeModulesBundle: true,
});
