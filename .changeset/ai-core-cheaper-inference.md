---
"@sahan-sac/ai-core": minor
---

Add Cheaper Inference as a provider adapter (`cheaperinference`). It is keyed by `CHEAPER_INFERENCE_API_KEY`, with `OMNIROUTE_API_KEY` accepted as an alias. It is paid, so it runs only with `AI_ALLOW_PAID`, and it is the first paid provider tried. Chat requests are sent with `zdr: true`, so visitor text reaches zero-data-retention routes only. A provider that answers 402 (empty prepaid wallet or no credits) now cools down for 30 minutes instead of being retried on every request. New exports: `cooldownFor` and `withJsonBody`.
