import { UniqueViolation } from "../errors";

/** Prisma's unique-constraint failure. */
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2002";
}

/** Prisma's "record to update or delete not found". */
export function isNotFound(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2025";
}

/**
 * Every message and code an error carries, its cause's included. Driver
 * adapter failures are not always `Error` instances (a reset socket surfaces
 * as a plain object), so reading only `error.message` would miss them.
 */
export function describeError(error: unknown, depth = 0): string {
  if (error === null || error === undefined || depth > 2) return "";
  if (typeof error !== "object") return String(error);
  const fields = error as { message?: unknown; code?: unknown; kind?: unknown; originalCode?: unknown; originalMessage?: unknown; cause?: unknown };
  const own = [fields.message, fields.code, fields.kind, fields.originalCode, fields.originalMessage].filter((value) => typeof value === "string");
  return [...own, describeError(fields.cause, depth + 1)].join(" ");
}

/**
 * True when the database was too slow or unreachable to finish (a connection
 * or pool timeout, a reset socket, an interactive transaction that expired, or
 * Neon refusing a project over its compute quota, SQLSTATE 53000), as opposed
 * to a bad request. The change was rolled back, so the caller can retry.
 */
export function isDbUnavailable(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "P1001" || code === "P1002" || code === "P1008" || code === "P1017" || code === "P2024" || code === "P2028") return true;
  return /expired transaction|Transaction API error|Can't reach database|timed out|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|Connection terminated|exceeded the (?:data transfer |compute time )?quota|\b53000\b/i.test(
    describeError(error)
  );
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
