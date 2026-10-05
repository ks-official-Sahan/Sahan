import { defineConfig } from "tsup";

// One entry per package.json `exports` subpath, emitted at the same relative
// path under dist/ so publishConfig.exports lines up. ESM only; node: builtins
// and every dependency stay external, never bundled.
export default defineConfig({
  entry: [
    "src/index.ts",
    "src/env.ts",
    "src/models.ts",
    "src/providers.ts",
    "src/adapters.ts",
    "src/vertex.ts",
    "src/image.ts",
    "src/guard.ts",
    "src/availability.ts",
    "src/log.ts",
  ],
  format: ["esm"],
  dts: { resolve: false },
  tsconfig: "tsconfig.build.json",
  outDir: "dist",
  splitting: false,
  sourcemap: false,
  clean: true,
  target: "es2022",
  platform: "node",
  external: ["next","react"],
  skipNodeModulesBundle: true,
});
