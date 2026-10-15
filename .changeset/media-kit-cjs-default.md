---
"@sahan-sac/media-kit": patch
---

Every export also has a `default` condition, so a CommonJS loader such as Next.js's `next.config.ts` can load it (Node 20.19+ and 22.12+ load the ESM build through `require(esm)`). A template can now build `images.remotePatterns` from `@sahan-sac/media-kit/accounts`; with 0.3.0 that import failed with ERR_PACKAGE_PATH_NOT_EXPORTED.
