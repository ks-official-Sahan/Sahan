import bcrypt from "bcryptjs";

/** bcrypt cost for every stored password (docs/plan/admin-cms-adr.md, D10). */
export const BCRYPT_COST = 12;

export function hashPassword(plain: string, cost: number = BCRYPT_COST): Promise<string> {
  return bcrypt.hash(plain, cost);
}

/** False for a malformed hash as well, never throws. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
