import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Invite and password-reset links. The link carries `<random>.<tag>`: `random` is
// random bytes, `tag` is a keyed MAC of it. The database stores only the
// SHA-256 of `random`, so a database leak yields no usable link, and the proxy
// can reject a forged link without a database read. No server-only import: the
// proxy runs this. docs/plan/admin-cms-adr.md, section 6.5.
//
// Two formats verify. v2, which createToken makes, is 16 random bytes (128
// bits, 22 characters) and a 64-bit tag (11 characters): 34 characters, short
// enough for a short link. v1 (32 bytes and a 128-bit tag, 66 characters) is
// still accepted, so links already sent keep working until they expire. The
// tag only lets the proxy skip a database read for a forged link; the stored
// hash of the 128-bit random part is what makes a link valid.

export const INVITE_TTL_HOURS = 72;
export const RESET_TTL_MINUTES = 60;

const LABEL = "invite-token:v1";

const FORMATS = [
  { random: /^[A-Za-z0-9_-]{22}$/, tag: /^[A-Za-z0-9_-]{11}$/, tagBytes: 8 },
  { random: /^[A-Za-z0-9_-]{43}$/, tag: /^[A-Za-z0-9_-]{22}$/, tagBytes: 16 },
] as const;

const tagOf = (random: string, secret: string, bytes: number) =>
  createHmac("sha256", createHmac("sha256", secret).update(LABEL).digest())
    .update(random)
    .digest()
    .subarray(0, bytes)
    .toString("base64url");

export const hashToken = (random: string) => createHash("sha256").update(random).digest("hex");

export function createToken(secret: string): { token: string; hash: string } {
  const random = randomBytes(16).toString("base64url");
  return { token: `${random}.${tagOf(random, secret, FORMATS[0].tagBytes)}`, hash: hashToken(random) };
}

/** The `random` part when the tag is right, otherwise null. Needs no database. */
export function verifyTokenTag(token: string | null | undefined, secret: string | undefined): string | null {
  if (!token || !secret || token.length > 128) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [random, tag] = parts;
  const format = FORMATS.find((candidate) => candidate.random.test(random) && candidate.tag.test(tag));
  if (!format) return null;
  const expected = Buffer.from(tagOf(random, secret, format.tagBytes));
  const given = Buffer.from(tag);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return random;
}

export type TokenState = "valid" | "used" | "expired" | "revoked";

export function tokenState(
  row: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: number
): TokenState {
  if (row.revokedAt) return "revoked";
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() <= now) return "expired";
  return "valid";
}
