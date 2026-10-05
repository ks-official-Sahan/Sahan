---
"@sahan-sac/ai-core": minor
---

Owner guidance and on-demand checks. `@sahan-sac/ai-core/guard` adds `guidanceSection(text)`, which appends the site owner's standing guidance after a prompt's fixed rules (it steers, never overrides them, and never changes how fenced data is treated), `mergeGuidance(...parts)` to join global and per-feature guidance, and an optional `maxLength` on `wrapUserData`. `@sahan-sac/ai-core/adapters` adds `checkProvider(env, id)` and `checkChain(env, purpose)`: each sends a one-line prompt (a few tokens) through one adapter or a whole chain and reports who answered, how long it took and every fall-through, for a health screen's manual Check button. Neither runs on its own, and neither cools a provider down for real traffic.
