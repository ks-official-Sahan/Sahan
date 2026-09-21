// Static security headers for every route, applied through next.config.ts
// (docs/plan/admin-cms-adr.md, section 6.6). The /admin CSP is per request and
// comes from proxy.ts. Camera, microphone and geolocation are never used here;
// the site only plays audio.

export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
] as const;
