import { bindings, defineConfig, defineWorker } from "cf/config";

import { workerSecretNames } from "./scripts/worker-secrets.mjs";

// The vinext build on Cloudflare Workers. Next.js on Vercel ignores this file.
//
// Every variable documented in .env.example that is set where this runs is a
// declared secret (scripts/worker-secrets.mjs): the local preview loads those
// from .env.local / .dev.vars, and a deploy fails if one is missing on the
// Worker. Upload them with `pnpm secrets:vinext` before the first deploy.
export default defineConfig(({ mode }) => ({
  worker: defineWorker({
    name: "sahan-portfolio",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-03",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      VINEXT_KV_CACHE: bindings.kv(),
      ...Object.fromEntries(workerSecretNames(process.cwd(), mode).map((name) => [name, bindings.secret()])),
    },
  }),
}));
