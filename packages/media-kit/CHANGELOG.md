# @sahan-sac/media-kit

## 0.2.0

### Minor Changes

- c2cc383: Site-specific values are now options with neutral defaults. blog-kit: `BlogAiDeps.site` (a `BlogSiteProfile`: description, allowed internal links, call-to-action paths) feeds every prompt, `realBlogDeps(env, site)` takes it, inline image tokens are `ai-image://N`, and `draftStorageKey(id, prefix)` takes a key prefix (default "admin"). chat-kit: `ChatSite` gains optional `kind`, `scope` and `linkExample` (default wording says "site"), and `CHAT_VISITOR_COOKIE` defaults to "chat_vid". media-kit: `MEDIA_CONFIG.uploadFolder` is removed; the upload folder is the app's own constant.

## 0.1.0

### Minor Changes

- b620f44: First release: Cloudinary config, upload and format validation, HMAC URL and upload signing, delivery URL transforms, a browser upload client and a typed CloudinaryClient. The database-backed service and audit trail stay in the host app. Licensed Apache-2.0.
