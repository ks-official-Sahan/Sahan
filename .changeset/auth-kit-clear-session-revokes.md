---
"@sahan-sac/auth-kit": minor
---

`authKitSessions` and `createAuthKitBetterAuth` take `revokeSession`; with it, `authKitClearSession` revokes the session it clears, so a browser or native client signing out over HTTP leaves no live row behind. The `./engines/better-auth` engine wires it to the session store.
