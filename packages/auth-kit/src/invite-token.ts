import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Invite and password-reset links. The link carries `<random>.<tag>`: `random` is
// 32 random bytes, `tag` is a keyed MAC of it. The database stores only the
// SHA-256 of `random`, so a database leak yields no usable link, and the proxy
// can reject a forged link without a database read. No server-only import: the
// proxy runs this. docs/plan/admin-cms-adr.md, section 6.5.

export const INVITE_TTL_HOURS = 72;
export const RESET_TTL_MINUTES = 60;

const LABEL = "invite-token:v1";
const RANDOM = /^[A-Za-z0-9_-]{43}$/;
const TAG = /^[A-Za-z0-9_-]{22}$/;

const tagOf = (random: string, secret: string) =>
  createHmac("sha256", createHmac("sha256", secret).update(LABEL).digest())
    .update(random)
    .digest()
    .subarray(0, 16)
    .toString("base64url");

export const hashToken = (random: string) => createHash("sha256").update(random).digest("hex");

export function createToken(secret: string): { token: string; hash: string } {
  const random = randomBytes(32).toString("base64url");
  return { token: `${random}.${tagOf(random, secret)}`, hash: hashToken(random) };
}

/** The `random` part when the tag is right, otherwise null. Needs no database. */
export function verifyTokenTag(token: string | null | undefined, secret: string | undefined): string | null {
  if (!token || !secret || token.length > 128) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [random, tag] = parts;
  if (!RANDOM.test(random) || !TAG.test(tag)) return null;
  const expected = Buffer.from(tagOf(random, secret));
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
