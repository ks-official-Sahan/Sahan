import { randomBytes } from "node:crypto";

import { serve } from "@hono/node-server";

import { createApp } from "./app";
import { createAuth, createLimiter } from "./auth";
import { openDatabase } from "./db";

const production = process.env.NODE_ENV === "production";
const secret = process.env.BETTER_AUTH_SECRET ?? (production ? "" : randomBytes(32).toString("hex"));
if (secret.length < 32) throw new Error("Set BETTER_AUTH_SECRET to at least 32 characters.");

const port = Number(process.env.PORT ?? 8787);
const baseURL = process.env.BETTER_AUTH_URL ?? `http://localhost:${port}`;
const siteUrl = process.env.SITE_URL;

const { db } = await openDatabase({ url: process.env.DATABASE_URL, dataDir: process.env.PGLITE_DIR });
const limiter = createLimiter();
const auth = createAuth({
  db,
  limiter,
  secret,
  baseURL,
  trustedOrigins: siteUrl ? [siteUrl] : undefined,
  audit: async (event) => console.info(JSON.stringify({ audit: event })),
});

serve({ fetch: createApp({ auth, db, limiter, siteUrl }).fetch, port }, (info) => {
  console.info(`API on http://localhost:${info.port}`);
});
