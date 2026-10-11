import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { getRedis, REDIS_PREFIX } from "@/lib/cache/redis";
import { log } from "@/lib/log";

import { lastDays, RETENTION_DAYS, utcDay, type AnalyticsRange, type Device } from "./classify";

// First-party analytics on Redis. Per UTC day:
//   a:{day}:n  hash    pv, d:<device>, b:<browser>, o:<os>, c:<country>
//   a:{day}:u  HLL     daily visitor ids (unique visitors, ~0.8% error)
//   a:{day}:p  zset    path -> views
//   a:{day}:r  zset    referrer host -> views
//   a:live     zset    visitor id -> last seen (ms), for "on the site now"
//   a:salt:{day}       random salt, deleted after two days
// A visitor id is sha256(salt, IP, user agent), cut to 16 hex. The salt is
// random and expires, so after a day nobody (the owner included) can link
// an id to an IP or to the same visitor on another day. No cookie is set and
// no IP or user agent is stored. Without Redis nothing is recorded.

const TTL = RETENTION_DAYS * 86_400;
const LIVE_WINDOW_MS = 5 * 60_000;
/** Paths and referrers kept per day; the long tail is trimmed now and then. */
const MAX_MEMBERS = 500;

const key = (...parts: string[]) => `${REDIS_PREFIX}a:${parts.join(":")}`;

const salts = new Map<string, string>();

async function dailySalt(day: string): Promise<string | null> {
  const known = salts.get(day);
  if (known) return known;
  const redis = getRedis();
  if (!redis) return null;
  const saltKey = key("salt", day);
  // Every instance agrees on one salt per day: the first writer wins.
  const [, salt] = await redis.pipeline().set(saltKey, randomBytes(16).toString("hex"), { nx: true, ex: 2 * 86_400 }).get<string>(saltKey).exec();
  if (typeof salt !== "string") return null;
  salts.clear();
  salts.set(day, salt);
  return salt;
}

/** The day's anonymous visitor id, or null without Redis. */
export async function visitorId(ip: string, userAgent: string, now = Date.now()): Promise<string | null> {
  const salt = await dailySalt(utcDay(now));
  if (!salt) return null;
  return createHash("sha256").update(`${salt}\n${ip}\n${userAgent}`).digest("hex").slice(0, 16);
}

export interface PageView {
  visitor: string;
  path: string;
  referrer: string | null;
  device: Device;
  browser: string;
  os: string;
  country: string;
}

/** Counts one page view: one pipelined round trip (two on the day's first view). */
export async function recordPageView(view: PageView, now = Date.now()): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const day = utcDay(now);
  const [n, u, p, r, live] = [key(day, "n"), key(day, "u"), key(day, "p"), key(day, "r"), key("live")];
  try {
    const pipe = redis
      .pipeline()
      .hincrby(n, "pv", 1)
      .hincrby(n, `d:${view.device}`, 1)
      .hincrby(n, `b:${view.browser}`, 1)
      .hincrby(n, `o:${view.os}`, 1)
      .hincrby(n, `c:${view.country}`, 1)
      .pfadd(u, view.visitor)
      .zincrby(p, 1, view.path)
      .zadd(live, { score: now, member: view.visitor });
    if (view.referrer) pipe.zincrby(r, 1, view.referrer).expire(r, TTL);
    const [views] = (await pipe.exec()) as [number, ...unknown[]];

    if (views === 1) {
      await redis.pipeline().expire(n, TTL).expire(u, TTL).expire(p, TTL).expire(live, 2 * 86_400).exec();
    } else if (views % 50 === 0) {
      await redis
        .pipeline()
        .zremrangebyscore(live, 0, now - LIVE_WINDOW_MS)
        .zremrangebyrank(p, 0, -(MAX_MEMBERS + 1))
        .zremrangebyrank(r, 0, -(MAX_MEMBERS + 1))
        .exec();
    }
  } catch (error) {
    log.warn("analytics write failed", { error: String(error) });
  }
}

export interface Ranked {
  label: string;
  value: number;
}

export interface SiteAnalytics {
  generatedAt: string;
  range: AnalyticsRange;
  days: { day: string; views: number; visitors: number }[];
  totals: { views: number; visitors: number; previousViews: number; previousVisitors: number };
  /** Visitors seen in the last five minutes. */
  live: number;
  pages: Ranked[];
  referrers: Ranked[];
  countries: Ranked[];
  devices: Ranked[];
  browsers: Ranked[];
  systems: Ranked[];
}

const TOP = 8;

type RawHash = Record<string, unknown> | null;

/** Sums `prefix:*` fields across days into a list, largest first. */
function breakdown(hashes: RawHash[], prefix: string, limit = TOP): Ranked[] {
  const totals = new Map<string, number>();
  for (const hash of hashes) {
    if (!hash) continue;
    for (const [field, value] of Object.entries(hash)) {
      if (!field.startsWith(prefix)) continue;
      const label = field.slice(prefix.length);
      totals.set(label, (totals.get(label) ?? 0) + Number(value || 0));
    }
  }
  return [...totals]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** A ZRANGE WITHSCORES reply ([member, score, ...]) as a list. */
function pairs(reply: unknown): Ranked[] {
  if (!Array.isArray(reply)) return [];
  const out: Ranked[] = [];
  for (let index = 0; index + 1 < reply.length; index += 2) out.push({ label: String(reply[index]), value: Number(reply[index + 1]) });
  return out;
}

/** Turns the raw read pipeline replies into the dashboard summary. Pure, for tests. */
export function summarize(input: {
  range: AnalyticsRange;
  days: string[];
  hashes: RawHash[];
  dailyVisitors: unknown[];
  visitors: unknown;
  previousViews: unknown[];
  previousVisitors: unknown;
  live: unknown;
  pages: unknown;
  referrers: unknown;
  generatedAt: string;
}): SiteAnalytics {
  const days = input.days.map((day, index) => ({
    day,
    views: Number(input.hashes[index]?.pv ?? 0),
    visitors: Number(input.dailyVisitors[index] ?? 0),
  }));
  return {
    generatedAt: input.generatedAt,
    range: input.range,
    days,
    totals: {
      views: days.reduce((sum, day) => sum + day.views, 0),
      visitors: Number(input.visitors ?? 0),
      previousViews: input.previousViews.reduce<number>((sum, value) => sum + Number(value ?? 0), 0),
      previousVisitors: Number(input.previousVisitors ?? 0),
    },
    live: Number(input.live ?? 0),
    pages: pairs(input.pages),
    referrers: pairs(input.referrers),
    countries: breakdown(input.hashes, "c:"),
    devices: breakdown(input.hashes, "d:"),
    browsers: breakdown(input.hashes, "b:"),
    systems: breakdown(input.hashes, "o:"),
  };
}

/**
 * The summary for the last `range` days and the period before it, in one
 * pipelined round trip (top pages and referrers are merged server-side into
 * a short-lived key, so only the top entries come back). Null without Redis.
 */
export async function readSiteAnalytics(range: AnalyticsRange, now = Date.now()): Promise<SiteAnalytics | null> {
  const redis = getRedis();
  if (!redis) return null;
  const days = lastDays(now, range);
  const previous = lastDays(now, range, range).filter((day) => day >= utcDay(now, RETENTION_DAYS));
  const nonce = randomBytes(6).toString("hex");
  const [pagesTmp, refsTmp] = [key("tmp", nonce, "p"), key("tmp", nonce, "r")];

  const pipe = redis.pipeline();
  for (const day of days) pipe.hgetall(key(day, "n"));
  for (const day of days) pipe.pfcount(key(day, "u"));
  for (const day of previous) pipe.hget(key(day, "n"), "pv");
  pipe.pfcount(...(days.map((day) => key(day, "u")) as [string, ...string[]]));
  if (previous.length > 0) pipe.pfcount(...(previous.map((day) => key(day, "u")) as [string, ...string[]]));
  pipe.zcount(key("live"), now - LIVE_WINDOW_MS, "+inf");
  pipe.zunionstore(pagesTmp, days.length, days.map((day) => key(day, "p")));
  pipe.zrange(pagesTmp, 0, TOP - 1, { rev: true, withScores: true });
  pipe.zunionstore(refsTmp, days.length, days.map((day) => key(day, "r")));
  pipe.zrange(refsTmp, 0, TOP - 1, { rev: true, withScores: true });
  pipe.del(pagesTmp, refsTmp);

  const replies = await pipe.exec();
  let at = 0;
  const take = (count: number) => replies.slice(at, (at += count));
  const hashes = take(days.length) as RawHash[];
  const dailyVisitors = take(days.length);
  const previousViews = take(previous.length);
  const [visitors] = take(1);
  const [previousVisitors] = previous.length > 0 ? take(1) : [0];
  const [live, , pages, , referrers] = take(5);

  return summarize({
    range,
    days,
    hashes,
    dailyVisitors,
    visitors,
    previousViews,
    previousVisitors,
    live,
    pages,
    referrers,
    generatedAt: new Date(now).toISOString(),
  });
}
