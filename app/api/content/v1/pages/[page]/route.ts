import { NextResponse } from "next/server";

import { getPageContent } from "@/lib/cms/loaders";
import { isCmsPage } from "@/lib/cms/registry";
import { log } from "@/lib/log";
import { CONTENT_CACHE_HEADERS, CONTENT_CORS_HEADERS, CONTENT_NO_STORE_HEADERS } from "@/lib/api/content";

export async function GET(_request: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!isCmsPage(page)) return NextResponse.json({ error: "Page not found." }, { status: 404, headers: CONTENT_NO_STORE_HEADERS });

  try {
    const data = await getPageContent(page);
    return NextResponse.json({ apiVersion: 1, data }, { headers: CONTENT_CACHE_HEADERS });
  } catch (error) {
    log.error("public CMS page API failed", { page, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Content is temporarily unavailable." }, { status: 503, headers: { ...CONTENT_NO_STORE_HEADERS, "Retry-After": "5" } });
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CONTENT_CORS_HEADERS });
}
