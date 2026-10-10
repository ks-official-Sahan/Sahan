import { NextResponse } from "next/server";

import { getPostBySlug } from "@/lib/blog/queries";
import { CONTENT_CORS_HEADERS, contentNotFound, contentResponse, contentUnavailable, rejectUnknownParams } from "@/lib/api/content";
import { timed } from "@/lib/observability/timing";

export const GET = timed(async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const rejected = rejectUnknownParams(request);
  if (rejected) return rejected;
  const { slug } = await params;
  try {
    const data = await getPostBySlug(slug);
    // A miss is never cached: the post may be published a moment later.
    if (!data) return contentNotFound("Post not found.");
    return contentResponse(request, data);
  } catch (error) {
    return contentUnavailable("blog detail", error, { slug });
  }
});

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CONTENT_CORS_HEADERS });
}
