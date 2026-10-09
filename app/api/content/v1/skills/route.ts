import { NextResponse } from "next/server";

import { CONTENT_CACHE_HEADERS, CONTENT_CORS_HEADERS } from "@/lib/api/content";
import { getPublishedSkills } from "@/lib/collections";
import { log } from "@/lib/log";

export async function GET() {
  try {
    return NextResponse.json(
      { apiVersion: 1, data: (await getPublishedSkills()) ?? [] },
      { headers: CONTENT_CACHE_HEADERS }
    );
  } catch (error) {
    log.error("public skills API failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Content is temporarily unavailable." },
      { status: 503, headers: { ...CONTENT_CORS_HEADERS, "Cache-Control": "no-store", "Retry-After": "5" } }
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CONTENT_CORS_HEADERS });
}
