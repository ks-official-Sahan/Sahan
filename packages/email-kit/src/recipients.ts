import { assertAddress, EmailGuardError, MAX_RECIPIENTS } from "./guards";

/**
 * Who gets a redacted copy (CC) of an account email: valid addresses from
 * `cc`, without repeats (case-insensitive) and without the original's own
 * recipients, capped at the per-message limit. Invalid entries are dropped,
 * never thrown, so a typo in an env variable cannot stop the original mail.
 */
export function copyRecipients(cc: readonly string[], exclude: readonly string[]): string[] {
  const seen = new Set(exclude.map((address) => address.trim().toLowerCase()));
  const out: string[] = [];
  for (const raw of cc) {
    let address: string;
    try {
      address = assertAddress(raw, "cc");
    } catch (error) {
      if (error instanceof EmailGuardError) continue;
      throw error;
    }
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(address);
    if (out.length === MAX_RECIPIENTS) break;
  }
  return out;
}
