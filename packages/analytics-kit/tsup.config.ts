import { defineConfig } from "tsup";

// One entry per package.json `exports` subpath, emitted at the same relative
// path under dist/ so publishConfig.exports lines up. ESM only; node: builtins
// and @upstash/redis (a peer, used for types only) stay external.
export default defineConfig({
  entry: ["src/index.ts", "src/classify.ts", "src/store.ts", "src/collect.ts", "src/client.ts"],
  format: ["esm"],
  dts: { resolve: false },
  tsconfig: "tsconfig.build.json",
  outDir: "dist",
  splitting: true,
  sourcemap: false,
  clean: true,
  target: "es2022",
  platform: "node",
  skipNodeModulesBundle: true,
});
