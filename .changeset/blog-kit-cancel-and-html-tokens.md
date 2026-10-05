---
"@sahan-sac/blog-kit": minor
---

`generateBlogPost` and `generateSeoSuggestion` take an optional `signal` that stops their model calls (a cancelled post skips the repair pass). New `applyImageTokenToHtml` resolves an inline image token in the editor's HTML, so a late image can patch a body the admin is already editing instead of re-rendering over it.
