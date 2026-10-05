---
"@sahan-sac/ai-core": minor
---

`createAiService().generate()` takes an optional `signal`. Aborting it stops the chain at once: running attempts are aborted, no further provider starts, and the result is `errorClass: "aborted"`. Aborted attempts are not logged and do not put a provider into cooldown.
