import { headers } from "next/headers";
import { userAgent } from "next/server";

import { clientIp, UNKNOWN_IP } from "./ip";

export interface RequestDeviceDetails {
  name: string | null;
  ip: string | null;
  browser: string | null;
  os: string | null;
  when: string;
}

/** Who and what made this request, in the shape the security emails print. */
export async function requestDetails(name: string | null): Promise<RequestDeviceDetails> {
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
