import { createHash, randomBytes } from "node:crypto";

// Content Security Policy for the admin surface. A nonce needs dynamic
// rendering, so this is meant for a per-request build (the proxy calls it),
// not a static one. No server-only import: the proxy builds it.

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
  /** Extra `img-src` hosts, e.g. an image CDN. `'self' data: blob:` are always included. */
  imgHosts?: readonly string[];
  /** Extra `connect-src` hosts, e.g. an upload API. `'self'` is always included. */
  connectHosts?: readonly string[];
  /**
   * Keep `'unsafe-inline'` in `style-src`. Some component libraries (Mantine,
   * for one) inject inline `style=""` attributes at runtime that a nonce
   * cannot reach (nonces only cover `<style>`/`<link>` elements, not the
   * `style` attribute — there is no such thing as a "nonced inline style
   * attribute" in the CSP spec). Defaults to `true` for that reason; set it
   * to `false` once the app's UI library does not need it, since
   * `'unsafe-inline'` for styles is a real (if low-severity, CSS-injection
   * rather than script-injection) relaxation of the policy.
   */
  allowInlineStyles?: boolean;
}

export function buildCsp({ nonce, dev = false, imgHosts = [], connectHosts = [], allowInlineStyles = true }: CspOptions): string {
  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", sha256Source(LIT_FLAG_SCRIPT)];
  if (dev) script.push("'unsafe-eval'");

  const style = allowInlineStyles ? "'self' 'unsafe-inline'" : "'self'";

  const img = ["'self'", "data:", "blob:", ...imgHosts];
  const connect = ["'self'", ...connectHosts];
  if (dev) connect.push("ws:", "wss:");

  return [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    `style-src ${style}`,
    `img-src ${img.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
