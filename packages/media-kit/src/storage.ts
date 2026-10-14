import type { StorageAccount, StorageProvider } from "./accounts";

// Choosing where a new file goes, and moving on when an account cannot take
// it. Pure apart from the attempts it runs; the app supplies usage numbers
// and the "full" marks (kept in Redis or memory) through plain parameters.
//
// Reads never come through here: every asset stores its account id and its
// absolute URL, so serving or deleting a file goes straight to the one
// account that holds it. Nothing ever probes other accounts for a file,
// which could delete another account's file of the same name.

/**
 * How an account failed:
 * - quota: it is full (storage, plan or credit limit). Mark it full, try the next.
 * - rate-limited / unavailable: busy, timing out or down. Try the next, mark nothing.
 * - auth: credentials refused. Try the next, and report it, since it needs fixing.
 * - rejected: the file or request itself was refused. Stop: every account would refuse it.
 */
export type FailureKind = "quota" | "rate-limited" | "unavailable" | "auth" | "rejected";

export class StorageError extends Error {
  readonly kind: FailureKind;
  readonly status: number | null;
  readonly accountId: string | null;

  constructor(kind: FailureKind, message: string, options: { status?: number | null; accountId?: string | null; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "StorageError";
    this.kind = kind;
    this.status = options.status ?? null;
    this.accountId = options.accountId ?? null;
  }
}

const CLOUDINARY_QUOTA = /\b(?:quota|storage limit|plan limit|credits? (?:limit|exceeded)|account (?:is )?(?:full|over|suspended)|exceeded (?:your|the) (?:storage|plan|bandwidth|transformation)|upgrade your plan)\b/i;
const BUCKET_QUOTA = /<Code>(?:QuotaExceeded|ServiceQuotaExceeded|InsufficientStorage|StorageQuotaExceeded)<\/Code>/;
const BUCKET_SLOW = /<Code>(?:SlowDown|ServiceUnavailable)<\/Code>/;

/**
 * Classifies a provider response. `status` is null when no response came
 * back at all (network error, timeout). `body` is the error text or XML.
 * A rate limit is never "full": it would take a healthy account out of use.
 */
export function classifyFailure(provider: StorageProvider, status: number | null, body = ""): FailureKind {
  if (status === null) return "unavailable";
  if (provider === "cloudinary" ? CLOUDINARY_QUOTA.test(body) : BUCKET_QUOTA.test(body) || status === 507) return "quota";
  if (status === 429 || status === 420 || (status === 503 && BUCKET_SLOW.test(body))) return "rate-limited";
  if (status >= 500) return "unavailable";
  if (status === 401 || status === 403) return "auth";
  return "rejected";
}

export interface CandidateState {
  /** Bytes already recorded per account id (the app's own sum of stored sizes). */
  usedBytes?: ReadonlyMap<string, number>;
  /** Account ids currently marked full. */
  full?: ReadonlySet<string>;
  /** Account ids to leave out for this upload (already tried by the browser). */
  skip?: ReadonlySet<string>;
}

/**
 * The accounts a new file of `sizeBytes` may go to, best first: not
 * read-only, not marked full, not skipped, and under the soft cap with the
 * file added. The input order (slot priority) is kept.
 */
export function uploadCandidates(accounts: readonly StorageAccount[], sizeBytes: number, state: CandidateState = {}): StorageAccount[] {
  return accounts.filter((account) => {
    if (account.readOnly || state.full?.has(account.id) || state.skip?.has(account.id)) return false;
    if (account.capBytes === null) return true;
    return (state.usedBytes?.get(account.id) ?? 0) + Math.max(0, sizeBytes) <= account.capBytes;
  });
}

export interface FailoverHooks {
  /** An account answered "full": mark it so the next uploads skip it for a while. */
  onFull?: (account: StorageAccount) => void | Promise<void>;
  /** Anything worth a log line (auth failures, moving on). Never given a secret. */
  onProblem?: (message: string, meta: { accountId: string; kind: FailureKind; status: number | null }) => void;
}

/**
 * Runs `attempt` against each candidate in order until one succeeds. A
 * rejected file stops at once. When every account fails, the error says why
 * for each (kinds only, no secrets). The attempt should use a key it chose
 * itself, so a retry elsewhere never overwrites anything.
 */
export async function withFailover<T>(
  candidates: readonly StorageAccount[],
  attempt: (account: StorageAccount) => Promise<T>,
  hooks: FailoverHooks = {}
): Promise<{ account: StorageAccount; value: T }> {
  if (candidates.length === 0) throw new StorageError("quota", "No storage account can take this file: all are full, read-only or over their cap.");
  const tried: string[] = [];
  for (const account of candidates) {
    try {
      return { account, value: await attempt(account) };
    } catch (error) {
      const failure = error instanceof StorageError ? error : new StorageError("unavailable", error instanceof Error ? error.message : String(error), { cause: error });
      tried.push(`${account.id}: ${failure.kind}`);
      hooks.onProblem?.(`media upload to ${account.id} failed (${failure.kind})`, { accountId: account.id, kind: failure.kind, status: failure.status });
      if (failure.kind === "rejected") throw failure;
      if (failure.kind === "quota") await hooks.onFull?.(account);
    }
  }
  throw new StorageError("unavailable", `No storage account took the file (${tried.join(", ")}).`);
}
