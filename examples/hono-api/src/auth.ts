import { authKit, authKitEmailPassword } from "@sahan-sac/auth-kit/better-auth";
import type { AuditEvent } from "@sahan-sac/auth-kit/audit-event";
import { createRateLimit } from "@sahan-sac/auth-kit/cache/ratelimit";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import type { Database } from "./db";
import { schema } from "./db/schema";

// Bucket catalogue. In-memory by default; pass `redis` (Upstash) to
// createRateLimit when more than one instance serves traffic.
export function createLimiter() {
  return createRateLimit({
    "login:ip": { windowSeconds: 15 * 60, max: 30, failMode: "closed" },
    "login:acct": { windowSeconds: 15 * 60, max: 5, failMode: "closed" },
    "api:ip": { windowSeconds: 60, max: 120, failMode: "open" },
  });
}
export type Limiter = ReturnType<typeof createLimiter>;

export interface AuthOptions {
  db: Database;
  limiter: Limiter;
  secret: string;
  baseURL: string;
  trustedOrigins?: string[];
  audit?: (event: AuditEvent) => Promise<void>;
}

export function createAuth(options: AuthOptions) {
  return betterAuth({
    database: drizzleAdapter(options.db, { provider: "pg", schema }),
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: options.trustedOrigins,
    emailAndPassword: authKitEmailPassword(),
    plugins: [
      authKit({
        limit: (bucket, key) => options.limiter.limit(bucket, key),
        audit: options.audit,
      }),
    ],
  });
}
export type Auth = ReturnType<typeof createAuth>;
