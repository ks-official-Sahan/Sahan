// Storage accounts: up to 10 each of Cloudinary, AWS S3 and Cloudflare R2,
// in one priority order. Read from numbered env slots so secrets stay in the
// environment, never in the database:
//
//   MEDIA_ACCOUNT_<n>_ID         stable id, recorded on every asset (a-z 0-9 -)
//   MEDIA_ACCOUNT_<n>_PROVIDER   cloudinary | s3 | r2
//   MEDIA_ACCOUNT_<n>_CAP_GB     optional soft cap; the account takes no new
//                                uploads once its recorded files reach it
//   MEDIA_ACCOUNT_<n>_READ_ONLY  true: serve and delete its files, upload nowhere
//   cloudinary: _CLOUDINARY_URL (cloudinary://key:secret@cloud) or
//               _CLOUD_NAME, _API_KEY, _API_SECRET
//   s3:         _BUCKET, _REGION, _ACCESS_KEY_ID, _SECRET_ACCESS_KEY,
//               _PUBLIC_URL (https base the files are served from),
//               optional _ENDPOINT (any S3-compatible service)
//   r2:         _ACCOUNT_ID (Cloudflare account), _BUCKET, _ACCESS_KEY_ID,
//               _SECRET_ACCESS_KEY, _PUBLIC_URL (r2.dev or a custom domain)
//
// The slot number is the priority (1 first). Reordering means renumbering
// slots; the id never changes, because every stored asset names its account
// by id (an id derived from position would re-point old assets on a reorder).
// The single-account CLOUDINARY_* variables still work: they become account
// "cloudinary" ahead of every slot, unless a slot takes that id.
// Problems are reported by variable name, never by value.

export type StorageProvider = "cloudinary" | "s3" | "r2";

interface AccountBase {
  id: string;
  provider: StorageProvider;
  /** Priority: lower goes first. 0 is the legacy CLOUDINARY_* account. */
  slot: number;
  /** Soft cap in bytes for new uploads, or null for none. */
  capBytes: number | null;
  readOnly: boolean;
}

export interface CloudinaryAccount extends AccountBase {
  provider: "cloudinary";
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface BucketAccount extends AccountBase {
  provider: "s3" | "r2";
  /** https://<service endpoint>, no trailing slash; objects are addressed path-style under it. */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Public https base URL for delivery, no trailing slash. */
  publicUrl: string;
}

export type StorageAccount = CloudinaryAccount | BucketAccount;

export const MAX_ACCOUNTS_PER_PROVIDER = 10;
/** Highest slot number read. */
export const MAX_SLOTS = 30;
export const LEGACY_ACCOUNT_ID = "cloudinary";

const ID = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const REGION = /^[a-z0-9-]{2,32}$/;

export type EnvSource = Record<string, string | undefined>;

export interface AccountRegistry {
  /** Every usable account, highest priority first. */
  accounts: StorageAccount[];
  /** What was skipped or wrong, naming variables only. */
  problems: string[];
}

const read = (env: EnvSource, name: string) => {
  const value = env[name]?.trim();
  return value ? value : undefined;
};

function httpsBase(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.search || url.hash || url.username || url.password) return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

/** cloudinary://<key>:<secret>@<cloud>, the format Cloudinary's dashboard copies. */
function parseCloudinaryUrl(raw: string): { cloudName: string; apiKey: string; apiSecret: string } | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "cloudinary:" || !url.hostname || !url.username || !url.password) return null;
    return { cloudName: url.hostname, apiKey: decodeURIComponent(url.username), apiSecret: decodeURIComponent(url.password) };
  } catch {
    return null;
  }
}

function capBytes(env: EnvSource, prefix: string, problems: string[]): number | null {
  const raw = read(env, `${prefix}_CAP_GB`);
  if (raw === undefined) return null;
  const gb = Number(raw);
  if (!Number.isFinite(gb) || gb <= 0) {
    problems.push(`${prefix}_CAP_GB must be a positive number of gigabytes; no cap applied`);
    return null;
  }
  return Math.floor(gb * 1024 ** 3);
}

function slotAccount(env: EnvSource, slot: number, problems: string[]): StorageAccount | null {
  const prefix = `MEDIA_ACCOUNT_${slot}`;
  const id = read(env, `${prefix}_ID`);
  const provider = read(env, `${prefix}_PROVIDER`)?.toLowerCase();
  if (!id && !provider) return null;
  if (!id || !ID.test(id)) {
    problems.push(`${prefix}_ID must be 1-32 lowercase letters, digits or dashes; slot skipped`);
    return null;
  }
  const base = { id, slot, capBytes: capBytes(env, prefix, problems), readOnly: read(env, `${prefix}_READ_ONLY`)?.toLowerCase() === "true" };

  if (provider === "cloudinary") {
    const fromUrl = read(env, `${prefix}_CLOUDINARY_URL`);
    const cloudName = read(env, `${prefix}_CLOUD_NAME`);
    const apiKey = read(env, `${prefix}_API_KEY`);
    const apiSecret = read(env, `${prefix}_API_SECRET`);
    const parsed = fromUrl ? parseCloudinaryUrl(fromUrl) : cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
    if (!parsed) {
      problems.push(`${prefix} (cloudinary) needs ${prefix}_CLOUDINARY_URL or ${prefix}_CLOUD_NAME, _API_KEY and _API_SECRET; slot skipped`);
      return null;
    }
    return { ...base, provider: "cloudinary", ...parsed };
  }

  if (provider === "s3" || provider === "r2") {
    const bucket = read(env, `${prefix}_BUCKET`);
    const accessKeyId = read(env, `${prefix}_ACCESS_KEY_ID`);
    const secretAccessKey = read(env, `${prefix}_SECRET_ACCESS_KEY`);
    const publicUrl = httpsBase(read(env, `${prefix}_PUBLIC_URL`));
    let region: string | undefined;
    let endpoint: string | null;
    if (provider === "r2") {
      const accountId = read(env, `${prefix}_ACCOUNT_ID`);
      region = "auto";
      endpoint = accountId && /^[a-f0-9]{32}$/.test(accountId) ? `https://${accountId}.r2.cloudflarestorage.com` : null;
      if (!endpoint) problems.push(`${prefix}_ACCOUNT_ID must be the 32-character Cloudflare account id`);
    } else {
      region = read(env, `${prefix}_REGION`);
      const custom = read(env, `${prefix}_ENDPOINT`);
      endpoint = custom ? httpsBase(custom) : region && REGION.test(region) ? `https://s3.${region}.amazonaws.com` : null;
      if (!region || !REGION.test(region)) problems.push(`${prefix}_REGION must be an AWS region such as us-east-1`);
      if (custom && !endpoint) problems.push(`${prefix}_ENDPOINT must be an https URL`);
    }
    const bucketOk = Boolean(bucket && BUCKET.test(bucket));
    if (!bucketOk) problems.push(`${prefix}_BUCKET must be a valid bucket name`);
    if (!accessKeyId || !secretAccessKey) problems.push(`${prefix} needs ${prefix}_ACCESS_KEY_ID and ${prefix}_SECRET_ACCESS_KEY`);
    if (!publicUrl) problems.push(`${prefix}_PUBLIC_URL must be the https base URL the files are served from`);
    if (!bucketOk || !bucket || !accessKeyId || !secretAccessKey || !publicUrl || !endpoint || !region || !REGION.test(region)) {
      problems.push(`${prefix} (${provider}) slot skipped`);
      return null;
    }
    return { ...base, provider, endpoint, region, bucket, accessKeyId, secretAccessKey, publicUrl };
  }

  problems.push(`${prefix}_PROVIDER must be cloudinary, s3 or r2; slot skipped`);
  return null;
}

/** Every configured account, highest priority first, plus what was wrong. Pure. */
export function storageAccountsFromEnv(env: EnvSource): AccountRegistry {
  const problems: string[] = [];
  const accounts: StorageAccount[] = [];
  const perProvider = new Map<StorageProvider, number>();
  const ids = new Set<string>();

  const add = (account: StorageAccount, origin: string) => {
    if (ids.has(account.id)) {
      problems.push(`${origin}: id "${account.id}" is already used by another account; skipped`);
      return;
    }
    const count = perProvider.get(account.provider) ?? 0;
    if (count >= MAX_ACCOUNTS_PER_PROVIDER) {
      problems.push(`${origin}: more than ${MAX_ACCOUNTS_PER_PROVIDER} ${account.provider} accounts; skipped`);
      return;
    }
    perProvider.set(account.provider, count + 1);
    ids.add(account.id);
    accounts.push(account);
  };

  const slots: StorageAccount[] = [];
  for (let slot = 1; slot <= MAX_SLOTS; slot += 1) {
    const account = slotAccount(env, slot, problems);
    if (account) slots.push(account);
  }

  const legacyName = read(env, "CLOUDINARY_CLOUD_NAME");
  const legacyKey = read(env, "CLOUDINARY_API_KEY");
  const legacySecret = read(env, "CLOUDINARY_API_SECRET");
  const legacy =
    legacyName && legacyKey && legacySecret
      ? { cloudName: legacyName, apiKey: legacyKey, apiSecret: legacySecret }
      : parseCloudinaryUrl(read(env, "CLOUDINARY_URL") ?? "");
  if (legacy && !slots.some((account) => account.id === LEGACY_ACCOUNT_ID)) {
    add({ id: LEGACY_ACCOUNT_ID, provider: "cloudinary", slot: 0, capBytes: null, readOnly: false, ...legacy }, "CLOUDINARY_*");
  }
  for (const account of slots) add(account, `MEDIA_ACCOUNT_${account.slot}`);

  return { accounts, problems };
}

/** What may be shown about an account (admin screens, logs): never a key or secret. */
export function describeAccount(account: StorageAccount): {
  id: string;
  provider: StorageProvider;
  slot: number;
  capBytes: number | null;
  readOnly: boolean;
  where: string;
} {
  const where = account.provider === "cloudinary" ? account.cloudName : `${account.bucket} (${account.publicUrl})`;
  return { id: account.id, provider: account.provider, slot: account.slot, capBytes: account.capBytes, readOnly: account.readOnly, where };
}

/** https hosts delivered files load from, for next.config remotePatterns and CSP img-src. */
export function deliveryHosts(accounts: readonly StorageAccount[]): string[] {
  const hosts = new Set<string>();
  for (const account of accounts) hosts.add(account.provider === "cloudinary" ? "res.cloudinary.com" : new URL(account.publicUrl).host);
  return [...hosts];
}
