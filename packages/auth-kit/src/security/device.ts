import { parseUserAgent } from "../user-agent";
import { clientIp, UNKNOWN_IP } from "./ip";

export interface RequestDeviceDetails {
  name: string | null;
  ip: string | null;
  browser: string | null;
  os: string | null;
  when: string;
}

/** Who and what made a request, in the shape the security emails print. Works with any `Headers` (Next.js, Hono, Fetch). */
export function requestDetailsFromHeaders(headers: Headers, name: string | null): RequestDeviceDetails {
  const ip = clientIp(headers);
  const { browser, os } = parseUserAgent(headers.get("user-agent"));
  return { name, ip: ip === UNKNOWN_IP ? null : ip, browser, os, when: new Date().toUTCString() };
}
