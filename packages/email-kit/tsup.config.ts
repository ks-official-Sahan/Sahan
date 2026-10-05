import { defineConfig } from "tsup";

// One entry per package.json `exports` subpath, emitted at the same relative
// path under dist/ so publishConfig.exports lines up. ESM only; node: builtins
// and every dependency (resend, nodemailer, zod) stay external, never bundled.
export default defineConfig({
  entry: [
    "src/index.ts",
    "src/env.ts",
    "src/guards.ts",
    "src/config.ts",
    "src/service.ts",
    "src/health.ts",
    "src/layout.ts",
    "src/recipients.ts",
    "src/brevo-diagnostics.ts",
    "src/providers/resend.ts",
    "src/providers/brevo-smtp.ts",
    "src/providers/capture.ts",
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
  skipNodeModulesBundle: true,
});
