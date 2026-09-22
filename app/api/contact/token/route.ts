import { NextRequest, NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { issueToken } from "@/lib/inquiries/token";

// Issue a signed timing token. Valid from 3 seconds after issuance up to 2 hours.
// The token is used to prevent replay attacks on the contact form.

export async function GET(request: NextRequest) {
  const env = getEnv();
  const secret = env.INTERNAL_SIGNING_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "Token service unavailable" }, { status: 503 });
  }

  const token = issueToken(secret);
  return NextResponse.json({ token }, { status: 200 });
}
