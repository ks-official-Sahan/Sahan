# @sahan-sac/media-kit

## 0.4.0

### Minor Changes

- 261dbc3: Bucket helpers `listObjects` (one ListObjectsV2 page, with prefixes and a continuation token) and `getObject` (an object's bytes, or null when it is missing), signed like the existing HEAD, PUT and DELETE calls.

## 0.3.1

### Patch Changes

- dcc2a43: Every export also has a `default` condition, so a CommonJS loader such as Next.js's `next.config.ts` can load it (Node 20.19+ and 22.12+ load the ESM build through `require(esm)`). A template can now build `images.remotePatterns` from `@sahan-sac/media-kit/accounts`; with 0.3.0 that import failed with ERR_PACKAGE_PATH_NOT_EXPORTED. `engines.node` is now `^20.19.0 || >=22.12.0`, the versions with `require(esm)`, so no supported Node version gets ERR_REQUIRE_ESM from that condition.

## 0.3.0

### Minor Changes

- 35bc5c3: Add multi-provider storage: AWS S3 and Cloudflare R2 next to Cloudinary, up to 10 accounts per provider in one priority order.
  
  - `accounts`: reads numbered `MEDIA_ACCOUNT_<n>_*` env slots (plus the legacy `CLOUDINARY_*` variables) into a typed registry with stable ids, soft caps and read-only accounts; problems are reported by variable name, never by value.
  - `storage`: `classifyFailure` sorts provider errors into quota, rate-limited, unavailable, auth and rejected; `uploadCandidates` and `withFailover` move an upload to the next account only when that is safe, and mark an account full only on a real quota error.
  - `bucket`: presigned browser uploads plus HEAD, PUT and DELETE for S3 and R2 over plain `fetch`, with per-call credentials and timeouts.
  - `sigv4`: dependency-free AWS Signature Version 4 header signing and URL presigning, checked against AWS's published examples.
- 168caa4: The browser upload client now works with every storage account and fails over between them.
  
  - `uploadToMediaLibrary` sends the file's name and size to the sign route, uploads to whichever account it picks (Cloudinary, or a presigned PUT to an S3 or R2 bucket), and asks for the next account when one is full, busy, down or refusing its keys, up to 5 accounts. A file the account itself refuses is not retried. `RegisterUpload` gets an optional fourth `accountId` argument.
  - `config`: `contentTypeFor(format)`, the Content-Type a stored file is served with, chosen from the extension.
  - `accounts`: `deliveryPatterns` (for `images.remotePatterns`), `uploadOrigins` (for CSP `connect-src`) and `bucketApiBase`.
  - `env`: `MEDIA_FULL_TTL_S`, how long an account that answered "full" is skipped.

## 0.2.1

### Patch Changes

- 5e7f3cb: The build shares modules between subpaths (code splitting) instead of copying them into each one. Before, a class imported from two subpaths was two different classes, so `instanceof` failed (for example `EmailGuardError` from `@sahan-sac/email-kit/guards` against an error thrown through `./layout`), and module-level state such as caches existed once per subpath.

## 0.2.0

### Minor Changes

- c2cc383: Site-specific values are now options with neutral defaults. blog-kit: `BlogAiDeps.site` (a `BlogSiteProfile`: description, allowed internal links, call-to-action paths) feeds every prompt, `realBlogDeps(env, site)` takes it, inline image tokens are `ai-image://N`, and `draftStorageKey(id, prefix)` takes a key prefix (default "admin"). chat-kit: `ChatSite` gains optional `kind`, `scope` and `linkExample` (default wording says "site"), and `CHAT_VISITOR_COOKIE` defaults to "chat_vid". media-kit: `MEDIA_CONFIG.uploadFolder` is removed; the upload folder is the app's own constant.

## 0.1.0

### Minor Changes

- b620f44: First release: Cloudinary config, upload and format validation, HMAC URL and upload signing, delivery URL transforms, a browser upload client and a typed CloudinaryClient. The database-backed service and audit trail stay in the host app. Licensed Apache-2.0.
