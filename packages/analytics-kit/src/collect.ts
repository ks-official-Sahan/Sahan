import { browserOf, countryOf, deviceOf, isBot, normalizePath, optedOut, osOf, referrerHost } from "./classify";
import type { AnalyticsLogger, AnalyticsStore } from "./store";

// The page-view endpoint as a Web-standard handler, (Request) => Response, so
// it mounts in a Next.js route handler, Hono, Remix or any fetch server. The
// answer is always 204 and the write goes to `defer` (Next's `after`,
// Vercel's waitUntil, a Worker's ctx.waitUntil), so a slow or missing Redis
// never slows a page, and a caller learns nothing from the response.
//
// Origin/CSRF checks are the host app's job (the beacon only ever sends a
// same-origin POST); this handler only accepts small JSON bodies.

export interface CollectHandlerOptions {
  store: AnalyticsStore;
  /** The client's IP as the app trusts it (proxy hops, platform headers). */
  clientIp: (request: Request) => string;
  /** This site's hosts, so internal navigation is not counted as a referrer. The request's Host always counts. */
  siteHosts?: readonly (string | null | undefined)[];
  /** Per-visitor rate limit; answer false to drop the view. */
  allow?: (visitor: string) => Promise<boolean> | boolean;
  /** Runs the write after the response. Default: fire and forget. */
  defer?: (task: () => Promise<void>) => void;
  log?: AnalyticsLogger;
  /** Largest body accepted, in bytes. Default 1024. */
  maxBodyBytes?: number;
}

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/** The body as text, or null past `limit` bytes (checked while reading, not only from Content-Length). */
async function readSmallBody(request: Request, limit: number): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > limit) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export function createCollectHandler(options: CollectHandlerOptions): (request: Request) => Promise<Response> {
  const defer = options.defer ?? ((task) => void task());
  const limit = options.maxBodyBytes ?? 1024;

  return async function collect(request) {
    const headers = request.headers;
    const userAgent = headers.get("user-agent");
    if (request.method !== "POST" || !headers.get("content-type")?.includes("application/json") || isBot(userAgent) || optedOut(headers)) {
      return noContent();
    }

    const text = await readSmallBody(request, limit).catch(() => null);
    if (!text) return noContent();
    let body: { p?: unknown; r?: unknown } | null;
    try {
      body = JSON.parse(text) as { p?: unknown; r?: unknown } | null;
    } catch {
      return noContent();
    }
    const path = normalizePath(body?.p);
    if (!path || !userAgent) return noContent();

    const referrer = referrerHost(body?.r, [headers.get("host"), ...(options.siteHosts ?? [])]);
    const country = countryOf(headers);
    const ip = options.clientIp(request);

    defer(async () => {
      try {
        const visitor = await options.store.visitorId(ip, userAgent);
        if (!visitor) return;
        if (options.allow && !(await options.allow(visitor))) return;
        await options.store.record({ visitor, path, referrer, device: deviceOf(userAgent), browser: browserOf(userAgent), os: osOf(userAgent), country });
      } catch (error) {
        options.log?.warn("analytics beacon dropped", { error: String(error) });
      }
    });
    return noContent();
  };
}
