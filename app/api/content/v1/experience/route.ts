import { NextResponse } from "next/server";

import { Experience } from "@/contents/experience";
import { CONTENT_CACHE_HEADERS, CONTENT_CORS_HEADERS } from "@/lib/api/content";
import { getExperience } from "@/lib/collections";
import { log } from "@/lib/log";

export async function GET() {
  try {
    return NextResponse.json({ apiVersion: 1, data: await getExperience(Experience) }, { headers: CONTENT_CACHE_HEADERS });
  } catch (error) {
    log.error("public experience API failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Content is temporarily unavailable." },
      { status: 503, headers: { ...CONTENT_CORS_HEADERS, "Cache-Control": "no-store", "Retry-After": "5" } }
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CONTENT_CORS_HEADERS });
}
