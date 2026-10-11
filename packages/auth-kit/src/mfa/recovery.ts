import { createHmac, randomInt } from "node:crypto";

// Recovery codes: single-use codes a user keeps somewhere safe, for when the
// authenticator app or passkey is lost. Ten codes of eight characters
// (about 40 bits each) from an alphabet without look-alike characters.
// Only a keyed hash is stored, bound to the user, so a leaked table cannot
// be replayed against another account.

export const RECOVERY_CODE_COUNT = 10;
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const HALF = 4;

function randomPart(): string {
  let out = "";
  for (let i = 0; i < HALF; i++) out += ALPHABET[randomInt(0, ALPHABET.length)];
  return out;
}

/** New codes, formatted `xxxx-xxxx` for display. */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => `${randomPart()}-${randomPart()}`);
}

/** Lowercase, without spaces or dashes; null when it cannot be a recovery code. */
export function normalizeRecoveryCode(input: string): string | null {
  const clean = input.toLowerCase().replace(/[\s-]/g, "");
  return new RegExp(`^[${ALPHABET}]{${HALF * 2}}$`).test(clean) ? clean : null;
}

export function hashRecoveryCode(code: string, userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`recovery:v1:${userId}:${code}`).digest("hex");
}
