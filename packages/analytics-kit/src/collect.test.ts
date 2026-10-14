import assert from "node:assert/strict";
import { test } from "node:test";

import { createCollectHandler, type CollectHandlerOptions } from "./collect";
import type { AnalyticsStore, PageView } from "./store";

const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

/** A store that records what it was given, never Redis. */
function fakeStore() {
  const views: PageView[] = [];
  const ids: Array<{ ip: string; userAgent: string }> = [];
  const store: AnalyticsStore = {
    async visitorId(ip, userAgent) {
      ids.push({ ip, userAgent });
      return "visitor-1";
    },
    async record(view) {
      views.push(view);
    },
    async read() {
      return null;
    },
  };
  return { store, views, ids };
}

function beacon(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/collect", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": BROWSER, host: "example.com", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** A handler whose deferred work is awaited before each assertion. */
function handler(extra: Partial<CollectHandlerOptions> = {}) {
  const { store, views, ids } = fakeStore();
  const pending: Array<Promise<void>> = [];
  const collect = createCollectHandler({
    store,
    clientIp: () => "203.0.113.7",
    siteHosts: ["www.example.org"],
    defer: (task) => void pending.push(task()),
    ...extra,
  });
  const run = async (request: Request) => {
    const response = await collect(request);
    await Promise.all(pending);
    return response;
  };
  return { run, views, ids };
}

test("a real view is counted with its labels and an external referrer host", async () => {
  const { run, views, ids } = handler();
  const response = await run(beacon({ p: "/works/", r: "https://www.google.com/search?q=x" }, { "x-vercel-ip-country": "lk" }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(views, [{ visitor: "visitor-1", path: "/works", referrer: "google.com", device: "desktop", browser: "Chrome", os: "Windows", country: "LK" }]);
  assert.deepEqual(ids, [{ ip: "203.0.113.7", userAgent: BROWSER }]);
});

test("internal referrers (the request host or a listed site host) are not counted", async () => {
  const { run, views } = handler();
  await run(beacon({ p: "/", r: "https://example.com/about" }));
  await run(beacon({ p: "/", r: "https://example.org/about" }));
  assert.deepEqual(
    views.map((view) => view.referrer),
    [null, null]
  );
});

test("bots, opt-outs, bad bodies and non-page paths answer 204 and record nothing", async () => {
  const { run, views } = handler();
  const cases = [
    beacon({ p: "/" }, { "user-agent": "curl/8.5.0" }),
    beacon({ p: "/" }, { dnt: "1" }),
    beacon({ p: "/" }, { "sec-gpc": "1" }),
    beacon({ p: "/admin/users" }),
    beacon({ p: "https://evil.example/" }),
    beacon("not json"),
    beacon("null"),
    beacon(""),
    new Request("https://example.com/api/collect", { method: "POST", headers: { "content-type": "text/plain", "user-agent": BROWSER }, body: "{}" }),
    new Request("https://example.com/api/collect", { method: "GET", headers: { "user-agent": BROWSER } }),
  ];
  for (const request of cases) assert.equal((await run(request)).status, 204);
  assert.equal(views.length, 0);
});

test("a body over the limit is refused while it is read", async () => {
  const { run, views } = handler({ maxBodyBytes: 64 });
  await run(beacon({ p: "/", padding: "x".repeat(200) }));
  assert.equal(views.length, 0);
});

test("the rate limit can drop a view", async () => {
  const { run, views } = handler({ allow: (visitor) => visitor !== "visitor-1" });
  await run(beacon({ p: "/" }));
  assert.equal(views.length, 0);
});

test("a store failure is logged, never thrown", async () => {
  const warnings: string[] = [];
  const pending: Array<Promise<void>> = [];
  const collect = createCollectHandler({
    store: {
      visitorId: async () => {
        throw new Error("redis down");
      },
      record: async () => {},
      read: async () => null,
    },
    clientIp: () => "unknown",
    defer: (task) => void pending.push(task()),
    log: { warn: (message) => warnings.push(message) },
  });
  assert.equal((await collect(beacon({ p: "/" }))).status, 204);
  await Promise.all(pending);
  assert.deepEqual(warnings, ["analytics beacon dropped"]);
});
