---
"@sahan-sac/ai-core": minor
---

OmniRoute provider. `omniroute` is a free adapter for a self-hosted OmniRoute gateway: one OpenAI-compatible endpoint that pools many providers' free tiers and fails over between them. It turns on with `OMNIROUTE_BASE_URL` (https, or http on localhost; `/v1` is added when missing; credentials in the URL are refused), sends `OMNIROUTE_API_KEY` when set, and defaults to the gateway's `auto/best-free` model (`OMNIROUTE_MODEL`, `BLOG_OMNIROUTE_MODEL` and `CHAT_OMNIROUTE_MODEL` override it). It is first in the default order, so it leads the chat and blog chains whenever it is configured, and it never needs `AI_ALLOW_PAID`.
