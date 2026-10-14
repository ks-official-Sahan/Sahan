---
"@sahan-sac/ai-core": patch
---

A provider that answers 402 (no credits, or an empty prepaid wallet) now cools down for 30 minutes instead of being retried on every request, so an unfunded account costs one probe per window rather than a failed round trip each time. `cooldownFor` is exported.
