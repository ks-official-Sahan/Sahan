import { NextResponse } from "next/server";

import { getPostBySlug } from "@/lib/blog/queries";
import { CONTENT_CACHE_HEADERS, CONTENT_CORS_HEADERS, CONTENT_NO_STORE_HEADERS } from "@/lib/api/content";
import { log } from "@/lib/log";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const data = await getPostBySlug(slug);
    // A miss is never cached: the post may be published a moment later.
    if (!data) return NextResponse.json({ error: "Post not found." }, { status: 404, headers: CONTENT_NO_STORE_HEADERS });
    return NextResponse.json({ apiVersion: 1, data }, { headers: CONTENT_CACHE_HEADERS });
  } catch (error) {
    log.error("public blog detail API failed", { slug, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Content is temporarily unavailable." }, { status: 503, headers: { ...CONTENT_NO_STORE_HEADERS, "Retry-After": "5" } });
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CONTENT_CORS_HEADERS });
}
