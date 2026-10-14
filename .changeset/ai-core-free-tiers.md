---
"@sahan-sac/ai-core": minor
---

Three more free-tier adapters:
- `groq`: Groq free plan, keyed by `GROQ_API_KEY`. Default models `openai/gpt-oss-120b` for the blog and `openai/gpt-oss-20b` for chat.
- `mistral`: Mistral free Experiment plan, keyed by `MISTRAL_API_KEY`. This plan may train on prompts, so the adapter runs in the blog chain only unless `AI_PROVIDER_ORDER_CHAT` lists it.
- `cloudflare`: Cloudflare Workers AI, with 10,000 free neurons a day. Needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_AI_API_TOKEN`.

None of them is paid, so none needs `AI_ALLOW_PAID`. Each model can be overridden per purpose. Adapters gain an optional `defaultPurposes`.
