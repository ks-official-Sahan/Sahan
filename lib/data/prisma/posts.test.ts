import assert from "node:assert/strict";
import { test } from "node:test";

import { UniqueViolation } from "../errors";
import { postRepo } from "./posts";

test("listPublishedPage reads due scheduled posts and preserves their intended order after promotion", async () => {
  const now = Date.now();
  const published = { id: "published", status: "PUBLISHED", publishedAt: new Date(now - 60_000), publishAt: null };
  const due = { id: "due", status: "SCHEDULED", publishedAt: null, publishAt: new Date(now - 30_000) };
  const promoted = { id: "promoted", status: "PUBLISHED", publishedAt: new Date(now), publishAt: new Date(now - 45_000) };
  const future = { id: "future", status: "SCHEDULED", publishedAt: null, publishAt: new Date(now + 60_000) };
  const client = {
    post: {
      findMany: async (args: { where: { status: string; publishAt?: { lte: Date } } }) => {
        if (args.where.status === "PUBLISHED" && !args.where.publishAt) return [published];
        if (args.where.status === "PUBLISHED") return [promoted];
        const cutoff = args.where.publishAt?.lte.getTime() ?? 0;
        return [due, future].filter((row) => row.publishAt.getTime() <= cutoff);
      },
    },
  };
  const result = await postRepo(client as never).listPublishedPage(10);
  assert.deepEqual(result.map((row) => row.id), ["due", "promoted", "published"]);
});

test("listPublishedPage applies the cursor to each status query and bounds the merged result", async () => {
  const now = new Date();
  const rows = [
    { id: "a", status: "PUBLISHED", publishedAt: new Date(now.getTime() - 1_000), publishAt: null },
    { id: "b", status: "SCHEDULED", publishedAt: null, publishAt: new Date(now.getTime() - 2_000) },
  ];
  let calls = 0;
  const client = {
    post: {
      findMany: async () => {
        calls += 1;
        return rows;
      },
    },
  };
  const result = await postRepo(client as never).listPublishedPage(1, { publishedAt: now, id: "z" });
  assert.equal(calls, 3);
  assert.deepEqual(result.map((row) => row.id), ["a"]);
});

test("indexable page excludes noindex rows at the database query", async () => {
  const whereClauses: Array<Record<string, unknown>> = [];
  const client = {
    post: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        whereClauses.push(args.where);
        return [];
      },
    },
  };
  await postRepo(client as never).listPublishedPage(20, undefined, true);
  assert.equal(whereClauses.length, 3);
  for (const where of whereClauses) assert.equal(where.noindex, false);
});

test("a PUBLISHED row with a future publishAt is not visible by slug", async () => {
  let where: Record<string, unknown> | undefined;
  const client = {
    post: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        where = args.where;
        return null;
      },
    },
  };
  await postRepo(client as never).findPublished("future-post");
  const visibleStatuses = where?.OR as Array<Record<string, unknown>>;
  assert.equal((visibleStatuses?.[0]?.OR as Array<Record<string, unknown>>)?.[1]?.publishAt !== undefined, true);
  assert.deepEqual(visibleStatuses?.[1], { status: "SCHEDULED", publishAt: { lte: (visibleStatuses?.[1]?.publishAt as { lte: Date }).lte } });
});

test("listPublicSlugs reads only slugs, under the same visibility rule as findPublished", async () => {
  const calls: Array<{ where: Record<string, unknown>; select?: Record<string, unknown> }> = [];
  const client = {
    post: {
      findMany: async (args: { where: Record<string, unknown>; select: Record<string, unknown> }) => {
        calls.push(args);
        return [{ slug: "a" }, { slug: "b" }];
      },
      findFirst: async (args: { where: Record<string, unknown> }) => {
        calls.push(args);
        return null;
      },
    },
  };
  const repo = postRepo(client as never);
  assert.deepEqual(await repo.listPublicSlugs(), ["a", "b"]);
  assert.deepEqual(calls[0]?.select, { slug: true });
  await repo.findPublished("a");
  const { slug, ...rule } = calls[1]?.where ?? {};
  assert.equal(slug, "a");
  assert.equal(JSON.stringify(calls[0]?.where.OR, (k, v) => (k === "lte" ? "now" : v)), JSON.stringify(rule.OR, (k, v) => (k === "lte" ? "now" : v)));
});

test("updateIfUnchanged answers null when the row changed since it was read", async () => {
  const client = { post: { update: async () => Promise.reject(Object.assign(new Error("not found"), { code: "P2025" })) } };
  assert.equal(await postRepo(client as never).updateIfUnchanged("p1", new Date(), { title: "x" }), null);
});

test("updateIfUnchanged turns a taken slug into UniqueViolation", async () => {
  const client = { post: { update: async () => Promise.reject(Object.assign(new Error("unique"), { code: "P2002" })) } };
  await assert.rejects(postRepo(client as never).updateIfUnchanged("p1", new Date(), { slug: "taken" }), UniqueViolation);
});
