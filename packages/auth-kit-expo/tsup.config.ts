import { defineConfig } from "tsup";

// One ESM entry. better-auth and react stay external, never bundled, so the
// app's own copies (and Metro's resolution of them) are used.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: { resolve: false },
  tsconfig: "tsconfig.build.json",
  outDir: "dist",
  splitting: false,
  sourcemap: false,
  clean: true,
  target: "es2022",
  platform: "neutral",
  external: ["better-auth", "react"],
  skipNodeModulesBundle: true,
});
