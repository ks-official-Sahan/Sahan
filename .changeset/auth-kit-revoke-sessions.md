---
"@sahan-sac/auth-kit": minor
---

The session store adds `revokeSessions(ids, by)`: ends a chosen set of sessions in one write and one cache delete, for a bulk "end selected" on an admin screen. Sessions that already ended are left as they were.
