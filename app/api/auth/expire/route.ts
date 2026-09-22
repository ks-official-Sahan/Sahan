import { NextResponse, type NextRequest } from "next/server";

import { LOGIN_PATH, SESSION_COOKIE } from "@/lib/auth/constants";

// A Server Component cannot write cookies [N20], so the data access layer sends a
// browser whose session was revoked, expired or disabled here. The cookie is
// cleared and the browser goes to the login page, which shows the form only while
// the unlock cookie is still valid (docs/plan/admin-cms-adr.md, section 6.2).

export function GET(request: NextRequest) {
  // A link on another site must not be able to sign the admin out.
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  // Nothing to expire: look like any other unknown URL.
  if (!request.cookies.has(SESSION_COOKIE)) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const url = request.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.search = "?reason=revoked";

  const response = NextResponse.redirect(url);
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
