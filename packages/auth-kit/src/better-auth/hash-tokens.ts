import { createHash } from "node:crypto";

// Better Auth looks a session up by its cookie token and, by default, stores
// that token as is: anyone who reads user_sessions (a backup, a replica, a SQL
// injection) could replay every live session. This adapter wrapper stores the
// SHA-256 of the token instead and hashes every lookup by token, so the
// cookie is the only place the token exists.

/** What user_sessions.token holds for a session cookie token. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

type Clause = { field: string; value?: unknown };
// Better Auth's DBAdapter, reduced to what this wrapper touches.
type Args = { model: string; where?: unknown; data?: Record<string, unknown>; update?: Record<string, unknown> };
type Method = (args: Args) => Promise<unknown>;
export interface HashableAdapter {
  create: Method;
  findOne: Method;
  findMany: Method;
  count: Method;
  update: Method;
  updateMany: Method;
  delete: Method;
  deleteMany: Method;
  transaction: <R>(callback: (trx: HashableAdapter) => Promise<R>) => Promise<R>;
}

const isTokenClause = (clause: Clause) => clause.field === "token" && typeof clause.value === "string";

function hashWhere(where: unknown): unknown {
  if (!Array.isArray(where)) return where;
  return (where as Clause[]).map((clause) => (isTokenClause(clause) ? { ...clause, value: hashSessionToken(clause.value as string) } : clause));
}

function hashFields(fields: Record<string, unknown> | undefined) {
  return fields && typeof fields.token === "string" ? { ...fields, token: hashSessionToken(fields.token) } : fields;
}

/** Wraps a resolved Better Auth adapter so session tokens are stored and matched as SHA-256 hashes. */
export function withHashedSessionTokens<A extends HashableAdapter>(adapter: A): A {
  const session = (args: Args) => args.model === "session";
  const hashed = (args: Args): Args => ({ ...args, where: hashWhere(args.where), ...(args.update ? { update: hashFields(args.update) } : {}) });
  const pass = (method: Method): Method => (args) => method(session(args) ? hashed(args) : args);

  return {
    ...adapter,
    async create(args: Args) {
      const raw = args.data?.token;
      if (!session(args) || typeof raw !== "string") return adapter.create(args);
      const row = (await adapter.create({ ...args, data: hashFields(args.data) })) as Record<string, unknown> | null;
      // Callers (the cookie) get the raw token back, never the stored hash.
      return row && { ...row, token: raw };
    },
    async findOne(args: Args) {
      if (!session(args)) return adapter.findOne(args);
      const raw = Array.isArray(args.where) ? (args.where as Clause[]).find(isTokenClause)?.value : undefined;
      const row = (await adapter.findOne(hashed(args))) as Record<string, unknown> | null;
      return row && typeof raw === "string" ? { ...row, token: raw } : row;
    },
    findMany: pass(adapter.findMany),
    count: pass(adapter.count),
    update: pass(adapter.update),
    updateMany: pass(adapter.updateMany),
    delete: pass(adapter.delete),
    deleteMany: pass(adapter.deleteMany),
    transaction: (callback) => adapter.transaction((trx) => callback(withHashedSessionTokens(trx))),
  } as A;
}
