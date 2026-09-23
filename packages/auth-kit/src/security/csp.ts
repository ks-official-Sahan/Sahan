import { createHash, randomBytes } from "node:crypto";

// Content Security Policy for /admin only. A nonce needs dynamic rendering, and
// the public pages are static, so they get no script CSP (docs/plan/admin-cms-adr.md,
// D18 and section 6.6). No server-only import: the proxy builds it.

/** Inline script in the root layout. Its hash is fixed, so it can be allowed. */
export const LIT_FLAG_SCRIPT = "window.litDisableDevMode = true;";

export function sha256Source(script: string): string {
  return `'sha256-${createHash("sha256").update(script).digest("base64")}'`;
}

export function generateNonce(): string {
  return randomBytes(16).toString("base64");
}

export interface CspOptions {
  nonce: string;
  /** Development needs eval for React's debug stacks and sockets for hot reload. */
  dev?: boolean;
}

export function buildCsp({ nonce, dev = false }: CspOptions): string {
  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", sha256Source(LIT_FLAG_SCRIPT)];
  if (dev) script.push("'unsafe-eval'");

  const connect = ["'self'", "https://api.cloudinary.com"];
  if (dev) connect.push("ws:", "wss:");

  return [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
