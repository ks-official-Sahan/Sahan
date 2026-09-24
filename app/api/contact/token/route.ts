import { createHmac } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { limit } from "@/lib/cache/ratelimit";
import { getEnv } from "@/lib/env";
import { issueToken } from "@/lib/inquiries/token";
import { clientIp, UNKNOWN_IP } from "@/lib/security/ip";

// Issue a signed timing token. Valid from 3 seconds after issuance up to 2 hours.
// The token is used to prevent replay attacks on the contact form.
//
// Per-IP rate limited on the existing contact:ip bucket (the same one
// app/api/contact/route.ts counts a submission against) — there is no
// dedicated bucket for this endpoint, and packages/auth-kit/src/cache/
// ratelimit.ts's LIMITS table is off limits to edit here, so a new
// contact:token bucket is not added; report this gap if per-endpoint budgets
// turn out to matter (a full contact flow currently spends two hits on
// contact:ip: one to fetch the token, one to submit). Fails open on an
// unknown IP, same R22 rule as sign-in (proxy.ts): without a resolvable IP
// every visitor would share one bucket, and contact:ip's own failMode is
// already "open".

function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export async function GET(request: NextRequest) {
  const env = getEnv();
  const secret = env.INTERNAL_SIGNING_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "Token service unavailable" }, { status: 503 });
  }

  const ip = clientIp(request.headers);
  if (ip !== UNKNOWN_IP) {
    const ipLimit = await limit("contact:ip", hashIp(ip, secret));
    if (!ipLimit.ok && !ipLimit.degraded) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(ipLimit.resetSeconds) } }
      );
    }
  }

  const token = issueToken(secret);
  return NextResponse.json({ token }, { status: 200 });
}
