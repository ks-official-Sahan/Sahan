// Second CSRF layer next to Next's own Origin and Host comparison for Server
// Actions: the proxy rejects unsafe requests to /admin and /api whose Origin is
// missing or foreign (docs/plan/admin-cms-adr.md, sections 4.5 and 6.6).

export interface OriginContext {
  /** `Host` and `X-Forwarded-Host` of the request. */
  hosts: ReadonlyArray<string | null | undefined>;
  /** Public site URL, for example https://sahansachintha.com */
  siteUrl?: string | null;
  /** Extra origins, from ADMIN_ALLOWED_ORIGINS (previews, for example). */
  extraOrigins?: readonly string[];
}

function originOf(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Splits a comma/whitespace separated origin list (an env var like
 * `ADMIN_ALLOWED_ORIGINS="https://preview-1.example.com, https://preview-2.example.com"`)
 * into trimmed, non-empty entries. The one parser for this shape, so the app
 * (proxy.ts) and this package's own `checkOrigin` convenience wrapper agree on
 * exactly the same list from the same raw value instead of each writing their
 * own regex.
 */
export function parseOriginList(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | null | undefined, context: OriginContext): boolean {
  if (!origin || origin === "null") return false;
  const parsed = originOf(origin);
  if (!parsed) return false;

  const host = new URL(parsed).host.toLowerCase();
  for (const candidate of context.hosts) {
    // A forwarded header can hold a list; the first entry is the original host.
    const first = candidate?.split(",")[0]?.trim().toLowerCase();
    if (first && first === host) return true;
  }

  const allowed = [context.siteUrl, ...(context.extraOrigins ?? [])];
  return allowed.some((entry) => (entry ? originOf(entry) === parsed : false));
}
