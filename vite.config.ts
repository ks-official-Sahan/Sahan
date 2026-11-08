import path from "node:path";

import { defineConfig, type Plugin } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";

// The vinext build. Next.js (Vercel) never reads this file.
//
// Default: Cloudflare Workers, with the KV data cache and Cloudflare Images.
// NITRO_PRESET set (for example `NITRO_PRESET=vercel pnpm build:vinext`):
// a Nitro build for that host instead, without the Cloudflare plugin or
// bindings. Kept buildable so the app is not tied to one host; production on
// Vercel runs the Next.js build.

/**
 * Points Prisma's generated client at its edge entry on Workers. The Worker
 * environments resolve the `node` export condition (nodejs_compat), which
 * selects the Node entry, and that one compiles the query compiler's Wasm at
 * runtime: Workers forbid that. The edge entry imports the `.wasm` file
 * statically instead, which the Cloudflare plugin bundles as a module.
 */
function prismaEdgeClient(): Plugin {
  const generated = /[\\/]\.prisma[\\/]client[\\/][^\\/]+$/;
  return {
    name: "sahan:prisma-edge-client",
    enforce: "pre",
    applyToEnvironment: (environment) => environment.name !== "client",
    resolveId(id, importer) {
      if (!importer || !generated.test(importer)) return null;
      if (id === "#main-entry-point") return path.join(path.dirname(importer), "edge.js");
      if (id === "#wasm-compiler-loader") return path.join(path.dirname(importer), "wasm-worker-loader.mjs");
      return null;
    },
  };
}

export default defineConfig(async () => {
  if (process.env.NITRO_PRESET) {
    const { nitro } = await import("nitro/vite");
    return { plugins: [vinext(), nitro()] };
  }
  return {
    plugins: [
      prismaEdgeClient(),
      vinext({
        cache: { data: kvDataAdapter() },
        images: { optimizer: imagesOptimizer() },
      }),
      cloudflare({
        viteEnvironment: {
          name: "rsc",
          childEnvironments: ["ssr"],
        },
      }),
    ],
  };
});
