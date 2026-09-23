import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getOptionalUser, hasPermission } from "@/lib/auth/dal";
import { limit } from "@/lib/cache/ratelimit";
import { checkOrigin } from "@/lib/security/check-origin";
import { defaultAiDeps, generateFullPost } from "@/lib/ai/blog";

// POST /api/admin/ai/generate-full. Requires generateAI, rate limited per
// user (ai:admin:user, shared with /draft and /cover). Body:
// { prompt, tone, length }. `prompt` is untrusted admin input, fenced as
// data by lib/ai/guard.ts before it reaches a model
// (docs/plan/admin-cms-adr.md, Step 12). Returns every field the blog editor
// form has (title, excerpt, topic, tags, SEO, body) from one AI call.

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  tone: z.enum(["professional", "casual", "technical", "enthusiastic"]).default("professional"),
  length: z.enum(["short", "medium", "long"]).default("medium"),
});

const notFound = () => new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
const forbidden = () => new NextResponse(null, { status: 403, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const user = await getOptionalUser();
  if (!user || user.mustChangePassword) return notFound();
  if (!hasPermission(user, "generateAI")) return notFound();

  if (!checkOrigin(request.headers, request)) return forbidden();

  const limited = await limit("ai:admin:user", user.id);
  if (!limited.ok) return new NextResponse(null, { status: 429, headers: { "Cache-Control": "no-store" } });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "A prompt is required." }, { status: 400 });
  }

  const result = await generateFullPost(parsed.data, defaultAiDeps());
  if (!result.ok) return NextResponse.json(result, { status: 502, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
