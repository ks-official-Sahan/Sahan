import { UniqueViolation } from "../errors";

/** Prisma's unique-constraint failure. */
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2002";
}

/** Runs a write, turning Prisma's unique-constraint failure into UniqueViolation. */
export async function translateUnique<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) throw new UniqueViolation();
    throw error;
  }
}
