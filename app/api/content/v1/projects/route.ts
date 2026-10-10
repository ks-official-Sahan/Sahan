import { NextResponse } from "next/server";

import { Projects } from "@/contents/projects";
import { getProjects } from "@/lib/collections";
import { CONTENT_CORS_HEADERS, contentResponse, contentUnavailable, rejectUnknownParams } from "@/lib/api/content";

export async function GET(request: Request) {
  const rejected = rejectUnknownParams(request);
  if (rejected) return rejected;
  try {
    return contentResponse(request, await getProjects(Projects));
  } catch (error) {
    return contentUnavailable("projects", error);
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CONTENT_CORS_HEADERS });
}
