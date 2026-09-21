// After sign-in the visitor is sent to `callbackUrl`. Only a same-origin path
// inside /admin is accepted, so the parameter can never become an open redirect
// (docs/plan/admin-cms-adr.md, section 6.2, point 6).

export const DEFAULT_CALLBACK = "/admin";

const CONTROL_OR_BACKSLASH = /[\x00-\x1f\x7f\\]/;
const DOT_SEGMENT = /(^|\/)\.\.?(\/|$|\?|#)/;

function unsafe(value: string): boolean {
  return (
    CONTROL_OR_BACKSLASH.test(value) ||
    value.includes("//") ||
    DOT_SEGMENT.test(value)
  );
}

export function safeCallbackUrl(input: unknown, fallback: string = DEFAULT_CALLBACK): string {
  if (typeof input !== "string" || input.length === 0 || input.length > 512) return fallback;
  const insideAdmin =
    input === "/admin" ||
    input.startsWith("/admin/") ||
    input.startsWith("/admin?") ||
    input.startsWith("/admin#");
  if (!insideAdmin || unsafe(input)) return fallback;

  // Check what the browser will see after percent decoding, too.
  let decoded: string;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    return fallback;
  }
  if (unsafe(decoded)) return fallback;

  // Coming back to the login page would show the form again.
  if (decoded === "/admin/login" || decoded.startsWith("/admin/login/") || decoded.startsWith("/admin/login?")) {
    return fallback;
  }
  return input;
}
