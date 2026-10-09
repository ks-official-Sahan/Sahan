import { NextResponse, type NextRequest } from "next/server";

import { decodePublicPostCursor, encodePublicPostCursor, getPublicPostPage } from "@/lib/blog/queries";
import { CONTENT_CACHE_HEADERS, CONTENT_CORS_HEADERS, CONTENT_NO_STORE_HEADERS } from "@/lib/api/content";
import { log } from "@/lib/log";

const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? 20);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > MAX_LIMIT) {
    return NextResponse.json({ error: `limit must be between 1 and ${MAX_LIMIT}.` }, { status: 400, headers: CONTENT_NO_STORE_HEADERS });
  }

  const cursor = decodePublicPostCursor(request.nextUrl.searchParams.get("cursor"));
  if (cursor === null) return NextResponse.json({ error: "Invalid cursor." }, { status: 400, headers: CONTENT_NO_STORE_HEADERS });

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
