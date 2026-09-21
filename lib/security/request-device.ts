import "server-only";

import { headers } from "next/headers";
import { userAgent } from "next/server";

import type { SignInDetails } from "@/lib/email/templates";
import { clientIp, UNKNOWN_IP } from "./ip";

/** Who and what made this request, in the shape the security emails print. */
export async function requestDetails(name: string | null): Promise<SignInDetails> {
  const h = await headers();
  const ip = clientIp(h);
  const parsed = userAgent({ headers: h });
  return {
    name,
    ip: ip === UNKNOWN_IP ? null : ip,
    browser: parsed.browser.name ?? null,
    os: parsed.os.name ?? null,
    when: new Date().toUTCString(),
  };
}
