import { createHash, createHmac } from "node:crypto";

// AWS Signature Version 4 for S3-compatible storage (AWS S3, Cloudflare R2),
// with no SDK: header signing for the server's own HEAD/PUT/DELETE calls,
// and query-string presigning for browser uploads that go straight to the
// bucket. Pure apart from the clock, which callers may pass in, and checked
// against AWS's published examples (sigv4.test.ts). Credentials are
// parameters; nothing here reads the environment or logs a secret.

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface SigningScope {
  /** "us-east-1", or "auto" for Cloudflare R2. */
  region: string;
  /** Always "s3" for object storage. */
  service?: string;
}

/** The SHA-256 S3 accepts in place of a body hash when the body is not signed. */
export const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
/** SHA-256 of an empty body. */
export const EMPTY_PAYLOAD_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const sha256Hex = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const hmac = (key: Buffer | string, value: string) => createHmac("sha256", key).update(value).digest();

/** RFC 3986 encoding as SigV4 wants it: every byte except A-Z a-z 0-9 - . _ ~ ; `/` kept in paths. */
function encode(value: string, keepSlash = false): string {
  let out = "";
  for (const byte of Buffer.from(value, "utf8")) {
    const char = String.fromCharCode(byte);
    if (/[A-Za-z0-9\-._~]/.test(char) || (keepSlash && char === "/")) out += char;
    else out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

/** 20130524T000000Z and 20130524 for a time. */
function stamps(now: Date): { amzDate: string; day: string } {
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { amzDate, day: amzDate.slice(0, 8) };
}

function signingKey(secret: string, day: string, region: string, service: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), service), "aws4_request");
}

function canonicalQuery(params: URLSearchParams): string {
  return [...params.entries()]
    .map(([key, value]) => [encode(key), encode(value)] as const)
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

/** The decoded path, re-encoded once (S3 does not normalise or double-encode paths). */
function canonicalPath(url: URL): string {
  return encode(decodeURIComponent(url.pathname), true) || "/";
}

function canonicalHeaders(headers: Record<string, string>): { block: string; names: string } {
  const entries = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, " ")] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return { block: entries.map(([name, value]) => `${name}:${value}\n`).join(""), names: entries.map(([name]) => name).join(";") };
}

function signature(input: {
  method: string;
  url: URL;
  query: URLSearchParams;
  headers: Record<string, string>;
  payloadHash: string;
  credentials: S3Credentials;
  scope: Required<SigningScope>;
  amzDate: string;
  day: string;
}): { signature: string; signedHeaders: string; credentialScope: string } {
  const { block, names } = canonicalHeaders(input.headers);
  const request = [input.method.toUpperCase(), canonicalPath(input.url), canonicalQuery(input.query), block, names, input.payloadHash].join("\n");
  const credentialScope = `${input.day}/${input.scope.region}/${input.scope.service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", input.amzDate, credentialScope, sha256Hex(request)].join("\n");
  const key = signingKey(input.credentials.secretAccessKey, input.day, input.scope.region, input.scope.service);
  return { signature: createHmac("sha256", key).update(toSign).digest("hex"), signedHeaders: names, credentialScope };
}

/**
 * Headers for a request the server makes itself: Authorization,
 * x-amz-date and x-amz-content-sha256, plus `headers` (all signed, with
 * Host). `payloadHash` is the body's SHA-256, or UNSIGNED_PAYLOAD.
 */
export function signS3Request(input: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  payloadHash?: string;
  credentials: S3Credentials;
  scope: SigningScope;
  now?: Date;
}): Record<string, string> {
  const url = new URL(input.url);
  const { amzDate, day } = stamps(input.now ?? new Date());
  const payloadHash = input.payloadHash ?? UNSIGNED_PAYLOAD;
  const headers: Record<string, string> = { ...input.headers, host: url.host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  const signed = signature({
    method: input.method,
    url,
    query: url.searchParams,
    headers,
    payloadHash,
    credentials: input.credentials,
    scope: { region: input.scope.region, service: input.scope.service ?? "s3" },
    amzDate,
    day,
  });
  const { host: _host, ...sent } = headers;
  return {
    ...sent,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.credentials.accessKeyId}/${signed.credentialScope}, SignedHeaders=${signed.signedHeaders}, Signature=${signed.signature}`,
  };
}

/**
 * A presigned URL valid for `expiresSeconds` (1 to 604800). Every header in
 * `headers` is signed, so the client must send exactly those values: pass
 * content-type and content-length to pin an upload's type and size.
 */
export function presignS3Url(input: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  expiresSeconds: number;
  credentials: S3Credentials;
  scope: SigningScope;
  now?: Date;
}): string {
  if (!Number.isInteger(input.expiresSeconds) || input.expiresSeconds < 1 || input.expiresSeconds > 604_800) {
    throw new Error("expiresSeconds must be a whole number from 1 to 604800");
  }
  const url = new URL(input.url);
  const { amzDate, day } = stamps(input.now ?? new Date());
  const scope = { region: input.scope.region, service: input.scope.service ?? "s3" };
  const headers: Record<string, string> = { ...input.headers, host: url.host };
  const { names } = canonicalHeaders(headers);

  const query = new URLSearchParams(url.searchParams);
  query.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  query.set("X-Amz-Credential", `${input.credentials.accessKeyId}/${day}/${scope.region}/${scope.service}/aws4_request`);
  query.set("X-Amz-Date", amzDate);
  query.set("X-Amz-Expires", String(input.expiresSeconds));
  query.set("X-Amz-SignedHeaders", names);

  const signed = signature({ method: input.method, url, query, headers, payloadHash: UNSIGNED_PAYLOAD, credentials: input.credentials, scope, amzDate, day });
  query.set("X-Amz-Signature", signed.signature);
  return `${url.origin}${canonicalPath(url)}?${canonicalQuery(query)}`;
}
