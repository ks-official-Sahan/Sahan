import { type KitSession, readBetterAuthSession } from "@sahan-sac/auth-kit/better-auth";
import { betterAuthRoute, originGuard, rateLimit, requirePermission, securityHeaders, session } from "@sahan-sac/auth-kit/hono";
import { count } from "drizzle-orm";
import { Hono } from "hono";

import type { Auth, Limiter } from "./auth";
import type { Database } from "./db";
import { user } from "./db/schema";

export interface AppOptions {
  auth: Auth;
  db: Database;
  limiter: Limiter;
  /** Public URL of the browser app that calls this API. */
  siteUrl?: string;
}

export function createApp({ auth, db, limiter, siteUrl }: AppOptions) {
  const app = new Hono();

  app.use(securityHeaders());
  app.use("/api/*", originGuard({ siteUrl }));
  app.use("/api/*", rateLimit({ limit: (key) => limiter.limit("api:ip", key) }));

  app.on(["GET", "POST"], "/api/auth/*", betterAuthRoute(auth));
  app.use("/api/*", session((headers) => readBetterAuthSession(auth, headers)));

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/me", requirePermission<KitSession>(), (c) => {
    const me = c.get("session")!;
    return c.json({ email: me.email, name: me.name, role: me.role });
  });

  // DEVELOPER only; everyone else gets the same 404 as a missing route.
  app.get(
    "/api/admin/stats",
    requirePermission<KitSession>((s) => s.role === "DEVELOPER"),
    async (c) => {
      const [row] = await db.select({ users: count() }).from(user);
      return c.json(row);
    }
  );

  return app;
}
