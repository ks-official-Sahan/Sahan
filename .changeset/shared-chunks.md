---
"@sahan-sac/ai-core": patch
"@sahan-sac/auth-kit": patch
"@sahan-sac/blog-kit": patch
"@sahan-sac/chat-kit": patch
"@sahan-sac/email-kit": patch
"@sahan-sac/media-kit": patch
---

The build shares modules between subpaths (code splitting) instead of copying them into each one. Before, a class imported from two subpaths was two different classes, so `instanceof` failed (for example `EmailGuardError` from `@sahan-sac/email-kit/guards` against an error thrown through `./layout`), and module-level state such as caches existed once per subpath.
