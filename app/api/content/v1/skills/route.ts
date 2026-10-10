import { NextResponse } from "next/server";

import { getPublishedSkills } from "@/lib/collections";
import { CONTENT_CORS_HEADERS, contentResponse, contentUnavailable, rejectUnknownParams } from "@/lib/api/content";
import { timed } from "@/lib/observability/timing";

export const GET = timed(async function GET(request: Request) {
  const rejected = rejectUnknownParams(request);
  if (rejected) return rejected;
  try {
    return contentResponse(request, (await getPublishedSkills()) ?? []);
  } catch (error) {
    return contentUnavailable("skills", error);
  }
});

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CONTENT_CORS_HEADERS });
}
