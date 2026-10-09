import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { decodePublicPostCursor, encodePublicPostCursor, getPublicPostPage } from "@/lib/blog/queries";
import { CONTENT_CACHE_HEADERS, CONTENT_CORS_HEADERS, CONTENT_NO_STORE_HEADERS } from "@/lib/api/content";
import { limit } from "@/lib/cache/ratelimit";
import { log } from "@/lib/log";
import { clientIp, UNKNOWN_IP } from "@/lib/security/ip";

const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? 20);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIMIT) {
    return NextResponse.json({ error: `limit must be between 1 and ${MAX_LIMIT}.` }, { status: 400, headers: CONTENT_NO_STORE_HEADERS });
  }

  const cursor = decodePublicPostCursor(request.nextUrl.searchParams.get("cursor"));
  if (cursor === null) return NextResponse.json({ error: "Invalid cursor." }, { status: 400, headers: CONTENT_NO_STORE_HEADERS });

  // First pages come from the data cache; a cursor page reads the database
  // (lib/blog/queries.ts, getPostPage), so cursor requests that miss the CDN
  // are rate-limited per IP. Open fail mode, and skipped when the IP is
  // unknown, like the contact form: availability over strictness for a read.
  if (cursor) {
    const ip = clientIp(request.headers);
    if (ip !== UNKNOWN_IP) {
      const rate = await limit("content:ip", createHash("sha256").update(ip).digest("hex").slice(0, 32));
      if (!rate.ok && !rate.degraded) {
        return NextResponse.json(
          { error: "Too many requests." },
          { status: 429, headers: { ...CONTENT_NO_STORE_HEADERS, "Retry-After": String(rate.resetSeconds) } }
        );
      }
    }
  }

  try {
    const page = await getPublicPostPage(rawLimit, cursor);
    return NextResponse.json(
      {
        apiVersion: 1,
        data: {
          ...page,
          nextCursor: page.nextCursor ? encodePublicPostCursor(page.nextCursor) : null,
        },
      },
      { headers: CONTENT_CACHE_HEADERS }
    );
  } catch (error) {
    log.error("public blog API failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Content is temporarily unavailable." }, { status: 503, headers: { ...CONTENT_NO_STORE_HEADERS, "Retry-After": "5" } });
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CONTENT_CORS_HEADERS });
}
