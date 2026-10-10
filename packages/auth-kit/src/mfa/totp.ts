import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Authenticator-app codes (TOTP, RFC 6238 over HOTP, RFC 4226): SHA-1, six
// digits, 30-second steps, which is what every common authenticator app
// expects. Pure, so it is unit tested against the RFC vectors and needs no
// database. The secret is stored sealed (./sealed.ts), never in the clear.

export const TOTP_DIGITS = 6;
export const TOTP_STEP_SECONDS = 30;
/** Steps either side of now that still count, for clock drift. */
export const TOTP_WINDOW = 1;
const SECRET_BYTES = 20;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("Invalid base32 secret.");
    value = ((value << 5) | index) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random secret, base32 encoded (what the authenticator app stores). */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES));
}

export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(message).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function totpStep(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
}

export function totpAt(secretBase32: string, nowMs: number): string {
  return hotp(base32Decode(secretBase32), totpStep(nowMs));
}

/**
 * The step that `code` matches within the window, or null. The caller must
 * refuse a step already used (replay), so one code works once.
 */
export function matchTotp(secretBase32: string, code: string, nowMs: number): number | null {
  const digits = code.replace(/[\s-]/g, "");
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(digits)) return null;
  const secret = base32Decode(secretBase32);
  const step = totpStep(nowMs);
  let matched: number | null = null;
  // Compare every step in the window, so the time taken does not say which one matched.
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset++) {
    const same = timingSafeEqual(Buffer.from(hotp(secret, step + offset)), Buffer.from(digits));
    if (same && matched === null) matched = step + offset;
  }
  return matched;
}

/** The otpauth:// URI an authenticator app scans (as a QR code) to add the account. */
export function otpauthUri(input: { issuer: string; account: string; secret: string }): string {
  const label = `${encodeURIComponent(input.issuer)}:${encodeURIComponent(input.account)}`;
  const query = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}
