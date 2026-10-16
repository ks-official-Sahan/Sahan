import { createHash, randomBytes } from "node:crypto";

import { bucketApiBase, type BucketAccount } from "./accounts";
import { presignS3Url, signS3Request } from "./sigv4";
import { classifyFailure, StorageError } from "./storage";

// Object operations on an S3 or R2 bucket over plain fetch, signed with
// SigV4 (sigv4.ts): a presigned PUT for browser uploads, and HEAD, PUT and
// DELETE for the server. Every call takes its account (credentials per
// call, no shared client state) and has its own timeout, and every failure
// is a StorageError with a kind (storage.ts) so the caller knows whether to
// move on to the next account.

export type FetchFn = typeof fetch;

const TIMEOUT_MS = 15_000;
/** How long a browser has to start its upload with a presigned URL. */
export const UPLOAD_URL_SECONDS = 300;

const credentials = (account: BucketAccount) => ({ accessKeyId: account.accessKeyId, secretAccessKey: account.secretAccessKey });
const scope = (account: BucketAccount) => ({ region: account.region });

/** Path segments encoded for a URL; `/` kept. */
const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

/** The API URL of an object (see bucketApiBase for the two URL styles). */
export function objectApiUrl(account: BucketAccount, key: string): string {
  return `${bucketApiBase(account)}/${encodeKey(key)}`;
}

/** Where the object is served from. */
export function objectPublicUrl(account: BucketAccount, key: string): string {
  return `${account.publicUrl}/${encodeKey(key)}`;
}

/**
 * A fresh object key under `folder`: <folder>/<yyyy>/<mm>/<24 hex>.<ext>.
 * Chosen by the server, never the client, so an upload or a retry on
 * another account can never overwrite an existing file.
 */
export function newObjectKey(folder: string, extension: string, now = new Date()): string {
  const safeFolder = folder.replace(/[^A-Za-z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "") || "uploads";
  const ext = extension.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${safeFolder}/${now.getUTCFullYear()}/${month}/${randomBytes(12).toString("hex")}.${ext}`;
}

async function call(account: BucketAccount, url: string, init: RequestInit, fetchFn: FetchFn): Promise<Response> {
  try {
    return await fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    throw new StorageError("unavailable", `${account.id} did not answer`, { accountId: account.id, cause: error });
  }
}

async function fail(account: BucketAccount, response: Response, what: string): Promise<never> {
  const body = await response.text().catch(() => "");
  const kind = classifyFailure(account.provider, response.status, body);
  throw new StorageError(kind, `${what} on ${account.id} failed with ${response.status}`, { status: response.status, accountId: account.id });
}

/**
 * A presigned PUT for the browser: it must send exactly this content type,
 * and a body of exactly `bytes` (the signed Content-Length), within
 * UPLOAD_URL_SECONDS. The bucket's CORS rules must allow PUT from the site.
 */
export function presignBucketUpload(
  account: BucketAccount,
  input: { key: string; contentType: string; bytes: number; now?: Date }
): { url: string; headers: Record<string, string>; expiresSeconds: number } {
  if (!Number.isInteger(input.bytes) || input.bytes <= 0) throw new StorageError("rejected", "The file size is not valid.");
  const url = presignS3Url({
    method: "PUT",
    url: objectApiUrl(account, input.key),
    headers: { "content-type": input.contentType, "content-length": String(input.bytes) },
    expiresSeconds: UPLOAD_URL_SECONDS,
    credentials: credentials(account),
    scope: scope(account),
    now: input.now,
  });
  // The browser sets Content-Length from the body itself; it may not send it by hand.
  return { url, headers: { "content-type": input.contentType }, expiresSeconds: UPLOAD_URL_SECONDS };
}

/**
 * What a bucket says to a one-key listing (ListObjectsV2):
 * - ok: the bucket exists and the keys may list it;
 * - no-list-permission: the keys are valid but may not list (a key scoped to
 *   reading and writing objects, which is all uploads need);
 * - missing-bucket, bad-credentials: needs fixing;
 * - unavailable: no answer, or a server error.
 */
export type BucketProbe = "ok" | "no-list-permission" | "missing-bucket" | "bad-credentials" | "unavailable";

export async function probeBucket(account: BucketAccount, fetchFn: FetchFn = fetch): Promise<BucketProbe> {
  const url = `${bucketApiBase(account)}?list-type=2&max-keys=1`;
  let response: Response;
  try {
    response = await call(account, url, { method: "GET", headers: signS3Request({ method: "GET", url, credentials: credentials(account), scope: scope(account) }) }, fetchFn);
  } catch {
    return "unavailable";
  }
  if (response.ok) return "ok";
  const code = /<Code>([^<]+)<\/Code>/.exec(await response.text().catch(() => ""))?.[1] ?? "";
  if (response.status === 404 || code === "NoSuchBucket") return "missing-bucket";
  if (code === "AccessDenied") return "no-list-permission";
  if (response.status === 401 || response.status === 403) return "bad-credentials";
  return "unavailable";
}

/** Size and type of a stored object, or null when it is not there. */
export async function headObject(account: BucketAccount, key: string, fetchFn: FetchFn = fetch): Promise<{ bytes: number; contentType: string | null } | null> {
  const url = objectApiUrl(account, key);
  const response = await call(account, url, { method: "HEAD", headers: signS3Request({ method: "HEAD", url, credentials: credentials(account), scope: scope(account) }) }, fetchFn);
  if (response.status === 404) return null;
  if (!response.ok) return fail(account, response, "HEAD");
  return { bytes: Number(response.headers.get("content-length") ?? 0), contentType: response.headers.get("content-type") };
}

/** Stores `body` under `key` (server-side uploads, e.g. generated images). */
export async function putObject(account: BucketAccount, key: string, body: Uint8Array, contentType: string, fetchFn: FetchFn = fetch): Promise<{ url: string; bytes: number }> {
  const url = objectApiUrl(account, key);
  const payloadHash = createHash("sha256").update(body).digest("hex");
  const headers = signS3Request({ method: "PUT", url, headers: { "content-type": contentType }, payloadHash, credentials: credentials(account), scope: scope(account) });
  const response = await call(account, url, { method: "PUT", headers, body: body as NonNullable<RequestInit["body"]> }, fetchFn);
  if (!response.ok) return fail(account, response, "PUT");
  return { url: objectPublicUrl(account, key), bytes: body.byteLength };
}

/** Deletes an object; true when it is gone (including already gone). */
export async function deleteObject(account: BucketAccount, key: string, fetchFn: FetchFn = fetch): Promise<boolean> {
  const url = objectApiUrl(account, key);
  const response = await call(account, url, { method: "DELETE", headers: signS3Request({ method: "DELETE", url, credentials: credentials(account), scope: scope(account) }) }, fetchFn);
  if (response.status === 204 || response.status === 200 || response.status === 404) return true;
  return fail(account, response, "DELETE");
}

/** One object in a listing. */
export interface ListedObject {
  key: string;
  bytes: number;
  lastModified: string;
}

/** One page of a ListObjectsV2 listing. */
export interface ObjectListing {
  objects: ListedObject[];
  /** Key prefixes up to the delimiter ("folders"), when one was given. */
  prefixes: string[];
  /** Pass back as `continuationToken` for the next page; null on the last. */
  nextToken: string | null;
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescapeXml = (value: string) => value.replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => XML_ENTITIES[name]);
const tagText = (xml: string, tag: string) => {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml);
  return match ? unescapeXml(match[1]) : null;
};

/** Parses a ListObjectsV2 response body. Exported for tests. */
export function parseObjectListing(xml: string): ObjectListing {
  const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([, block]) => ({
    key: tagText(block, "Key") ?? "",
    bytes: Number(tagText(block, "Size") ?? 0),
    lastModified: tagText(block, "LastModified") ?? "",
  }));
  const prefixes = [...xml.matchAll(/<CommonPrefixes>([\s\S]*?)<\/CommonPrefixes>/g)].map(([, block]) => tagText(block, "Prefix") ?? "");
  const truncated = tagText(xml, "IsTruncated") === "true";
  return { objects: objects.filter((object) => object.key), prefixes: prefixes.filter(Boolean), nextToken: truncated ? tagText(xml, "NextContinuationToken") : null };
}

/**
 * One page (up to 1000 keys) of the objects under `prefix`, in key order.
 * With a `delimiter` (usually "/"), keys below the next delimiter are rolled
 * up into `prefixes`, so a caller can list "folders" without every file.
 */
export async function listObjects(
  account: BucketAccount,
  input: { prefix?: string; delimiter?: string; continuationToken?: string; maxKeys?: number } = {},
  fetchFn: FetchFn = fetch
): Promise<ObjectListing> {
  const query = new URLSearchParams({ "list-type": "2" });
  if (input.prefix) query.set("prefix", input.prefix);
  if (input.delimiter) query.set("delimiter", input.delimiter);
  if (input.continuationToken) query.set("continuation-token", input.continuationToken);
  if (input.maxKeys) query.set("max-keys", String(Math.min(Math.max(1, Math.trunc(input.maxKeys)), 1000)));
  const url = `${bucketApiBase(account)}?${query}`;
  const response = await call(account, url, { method: "GET", headers: signS3Request({ method: "GET", url, credentials: credentials(account), scope: scope(account) }) }, fetchFn);
  if (!response.ok) return fail(account, response, "LIST");
  return parseObjectListing(await response.text());
}

/**
 * The bytes of an object, or null when it is not there. Reads the whole body
 * into memory, so it is meant for objects of a known, bounded size.
 */
export async function getObject(account: BucketAccount, key: string, fetchFn: FetchFn = fetch): Promise<Uint8Array | null> {
  const url = objectApiUrl(account, key);
  const response = await call(account, url, { method: "GET", headers: signS3Request({ method: "GET", url, credentials: credentials(account), scope: scope(account) }) }, fetchFn);
  if (response.status === 404) return null;
  if (!response.ok) return fail(account, response, "GET");
  return new Uint8Array(await response.arrayBuffer());
}
