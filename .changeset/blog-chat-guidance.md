---
"@sahan-sac/blog-kit": minor
"@sahan-sac/chat-kit": minor
---

Owner guidance and per-post steering. `BlogSiteProfile.guidance` and `ChatSite.guidance` add the site owner's standing guidance to every blog, SEO, helper and chatbot prompt, after the fixed rules. `BlogGenerationInput` takes optional `instructions` (up to `MAX_INSTRUCTIONS_LENGTH`, 2,000 characters) and `resources` (pasted reference text, up to `MAX_RESOURCES_LENGTH`, 12,000), both fenced as untrusted data: resources are used as facts, never as instructions, and nothing is fetched from a link.
