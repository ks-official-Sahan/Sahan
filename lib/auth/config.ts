import "server-only";

import NextAuth from "next-auth";

import { auditSafe } from "@/lib/admin/audit";
import { limit, LIMITS } from "@/lib/cache/ratelimit";
import { kv } from "@/lib/cache/redis";
import { db } from "@/lib/db/prisma";
import { seedOwner } from "@/lib/db/seed";
import { sendEmail } from "@/lib/email";
import { mfaCode, newLogin } from "@/lib/email/templates";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { createAuthConfig, createMfa, createSessionStore, ensureBootstrapOwner } from "@sahan/auth-kit";

import { prismaAuthAdapter } from "./prisma-adapter";

// Built once per module load; deps only ever wrap already-configured app
// singletons (db, kv, env), so there is nothing request-scoped to defer here.

const env = getEnv();
const authSecret = env.AUTH_SECRET;
if (!authSecret) throw new Error("AUTH_SECRET is not set");

// auth-kit's deps declare `limit`/`sendEmail` with the loose (bucket: string,
// message: { category: string }) shapes any app could have; the app's own
// versions are typed against its specific bucket names and email categories,
// so they are narrower than what a generic function-typed dep can accept
// structurally. The buckets and categories the package actually calls with
// (below) are always members of the app's own literal unions.
const limitAdapter = (bucket: string, key: string) => limit(bucket as Parameters<typeof limit>[0], key);
const sendEmailAdapter = (
  message: { to: string; subject: string; html: string; text: string; category: string },
  context: { actor: { id: string; email: string } }
) => sendEmail(message as Parameters<typeof sendEmail>[0], context);

const sessionStoreImpl = createSessionStore({ adapter: prismaAuthAdapter, kv, authSecret });
const mfaImpl = createMfa({
  adapter: prismaAuthAdapter,
  authSecret,
  limit: limitAdapter,
  sendEmail: sendEmailAdapter,
  audit: auditSafe,
  renderMfaCode: mfaCode,
});
const bootstrap = () => ensureBootstrapOwner(prismaAuthAdapter, () => seedOwner(db, process.env, "bootstrap"), log);

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(() =>
  createAuthConfig({
    adapter: prismaAuthAdapter,
    authSecret,
    authTrustHost: env.AUTH_TRUST_HOST,
    authDebug: env.AUTH_DEBUG,
    production: process.env.NODE_ENV === "production",
    sessionStore: sessionStoreImpl,
    mfa: mfaImpl,
    bootstrap,
    loginFailureWindowSeconds: LIMITS["login:acct"].windowSeconds,
    limit: limitAdapter,
    failures: {
      reserve: (key, windowSeconds) => kv.incr(key, windowSeconds),
      clear: (key) => kv.del(key).then(() => undefined),
    },
    audit: auditSafe,
    warn: (message, fields) => log.warn(message, fields),
    sendKnownDeviceEmail: async (input) => {
      const rendered = newLogin({ name: input.name, ip: input.ip, browser: input.browser, os: input.os, when: new Date().toUTCString() });
      await sendEmail(
        { to: input.email, subject: rendered.subject, html: rendered.html, text: rendered.text, category: "security" },
        { actor: { id: input.userId, email: input.email } }
      );
    },
  })
);
