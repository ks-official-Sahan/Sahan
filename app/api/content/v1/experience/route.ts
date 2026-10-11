import { NextResponse } from "next/server";

import { Experience } from "@/contents/experience";
import { getExperience } from "@/lib/collections";
import { CONTENT_CORS_HEADERS, contentResponse, contentUnavailable, rejectUnknownParams } from "@/lib/api/content";
import { timed } from "@/lib/observability/timing";

export const GET = timed(async function GET(request: Request) {
  const rejected = rejectUnknownParams(request);
  if (rejected) return rejected;
  try {
    return contentResponse(request, await getExperience(Experience));
  } catch (error) {
    return contentUnavailable("experience", error);
  }
});

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CONTENT_CORS_HEADERS });
}
