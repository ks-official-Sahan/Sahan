import type { AiEnv } from "@sahan-sac/ai-core/env";
import { realProviders, sharedAiHealth, type AiHealth, type AiProvider } from "@sahan-sac/ai-core/providers";

import type { BlogSiteProfile } from "./prompts";

// What every blog generator takes: the provider chain (injected, so tests use
// fakes and never touch the network) and, optionally, shared provider health.

export interface BlogAiDeps {
  providers: readonly AiProvider[];
  /** Cooldowns and latency learned across requests; a fresh one per call when omitted. */
  health?: AiHealth;
  /** How the full-post and SEO prompts describe the site and which paths they may link to. */
  site?: BlogSiteProfile;
}

export type AiHelperFailure = { ok: false; error: string };

/** The blog chain built from the configured provider keys, sharing process-wide health. */
export function realBlogDeps(env: AiEnv, site?: BlogSiteProfile): BlogAiDeps {
  return { providers: realProviders(env, "blog"), health: sharedAiHealth, site };
}
