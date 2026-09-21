// Client IP for rate limits and session records.
//
// On Vercel the platform sets x-vercel-forwarded-for, x-real-ip and
// x-forwarded-for itself, so they can be believed. Anywhere else a client can send
// any of them, and a bare `next start` keeps what the client sent (it does not
// append the socket address), so no header can be believed. Behind reverse
// proxies you run, set TRUSTED_PROXY_HOPS to how many of them append to
// x-forwarded-for; the entry that many places from the right is then the address
// the outermost trusted proxy saw. Without either, every caller is UNKNOWN_IP and
// shares one limiter bucket: safe against spoofing, at the cost that an attacker
// can use up a shared budget (docs/plan/admin-cms-adr.md, section 6.7, risk R22).

interface HeaderReader {
  get(name: string): string | null;
}

type Env = Record<string, string | undefined>;

const IP_LIKE = /^[0-9a-fA-F:.]{2,45}$/;

export const UNKNOWN_IP = "unknown";

function valid(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed && IP_LIKE.test(trimmed) ? trimmed.toLowerCase() : null;
}

/** 0 means no proxy is trusted. */
function hops(env: Env): number {
  const parsed = Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10 ? parsed : 0;
}

export function clientIp(headers: HeaderReader, env: Env = process.env): string {
  if (env.VERCEL) {
    const platform = [
      headers.get("x-vercel-forwarded-for"),
      headers.get("x-real-ip"),
      headers.get("x-forwarded-for")?.split(",")[0],
    ];
    for (const candidate of platform) {
      const ip = valid(candidate);
      if (ip) return ip;
    }
    return UNKNOWN_IP;
  }

  const trusted = hops(env);
  if (trusted === 0) return UNKNOWN_IP;
  const entries = (headers.get("x-forwarded-for") ?? "").split(",");
  return valid(entries[entries.length - trusted]) ?? UNKNOWN_IP;
}
