import assert from "node:assert/strict";
import { test } from "node:test";

import { deliveryHosts, deliveryPatterns, describeAccount, LEGACY_ACCOUNT_ID, storageAccountsFromEnv, uploadOrigins, type BucketAccount, type StorageAccount } from "./accounts";
import { deleteObject, headObject, newObjectKey, objectApiUrl, objectPublicUrl, presignBucketUpload, probeBucket, putObject } from "./bucket";
import { classifyFailure, StorageError, uploadCandidates, withFailover } from "./storage";

const R2_ACCOUNT_ID = "0123456789abcdef0123456789abcdef";

const env = {
  CLOUDINARY_CLOUD_NAME: "legacy-cloud",
  CLOUDINARY_API_KEY: "legacy-key",
  CLOUDINARY_API_SECRET: "legacy-secret",
  MEDIA_ACCOUNT_1_ID: "cld-2",
  MEDIA_ACCOUNT_1_PROVIDER: "cloudinary",
  MEDIA_ACCOUNT_1_CLOUDINARY_URL: "cloudinary://key2:secret2@cloud-two",
  MEDIA_ACCOUNT_2_ID: "r2-main",
  MEDIA_ACCOUNT_2_PROVIDER: "r2",
  MEDIA_ACCOUNT_2_ACCOUNT_ID: R2_ACCOUNT_ID,
  MEDIA_ACCOUNT_2_BUCKET: "media",
  MEDIA_ACCOUNT_2_ACCESS_KEY_ID: "r2-key",
  MEDIA_ACCOUNT_2_SECRET_ACCESS_KEY: "r2-secret",
  MEDIA_ACCOUNT_2_PUBLIC_URL: "https://media.example.com/",
  MEDIA_ACCOUNT_2_CAP_GB: "10",
  MEDIA_ACCOUNT_4_ID: "s3-archive",
  MEDIA_ACCOUNT_4_PROVIDER: "s3",
  MEDIA_ACCOUNT_4_REGION: "eu-west-1",
  MEDIA_ACCOUNT_4_BUCKET: "archive-bucket",
  MEDIA_ACCOUNT_4_ACCESS_KEY_ID: "s3-key",
  MEDIA_ACCOUNT_4_SECRET_ACCESS_KEY: "s3-secret",
  MEDIA_ACCOUNT_4_PUBLIC_URL: "https://cdn.example.com/archive",
  MEDIA_ACCOUNT_4_READ_ONLY: "true",
};

test("accounts come in slot order, with the legacy CLOUDINARY_* account first", () => {
  const { accounts, problems } = storageAccountsFromEnv(env);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    accounts.map((account) => [account.id, account.provider, account.slot]),
    [
      [LEGACY_ACCOUNT_ID, "cloudinary", 0],
      ["cld-2", "cloudinary", 1],
      ["r2-main", "r2", 2],
      ["s3-archive", "s3", 4],
    ]
  );
  const r2 = accounts[2] as BucketAccount;
  assert.equal(r2.endpoint, `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
  assert.equal(r2.region, "auto");
  assert.equal(r2.publicUrl, "https://media.example.com");
  assert.equal(r2.capBytes, 10 * 1024 ** 3);
  assert.equal(accounts[3].readOnly, true);
  assert.deepEqual(deliveryHosts(accounts), ["res.cloudinary.com", "media.example.com", "cdn.example.com"]);
  assert.deepEqual(deliveryPatterns(accounts), [
    { hostname: "res.cloudinary.com", port: "", pathname: "/legacy-cloud/**" },
    { hostname: "res.cloudinary.com", port: "", pathname: "/cloud-two/**" },
    { hostname: "media.example.com", port: "", pathname: "/**" },
    { hostname: "cdn.example.com", port: "", pathname: "/archive/**" },
  ]);
  // The read-only archive takes no uploads, so the browser never connects to it.
  assert.deepEqual(uploadOrigins(accounts), ["https://api.cloudinary.com", `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`]);
});

test("a slot that takes the legacy id replaces the CLOUDINARY_* account, so it can be moved", () => {
  const { accounts } = storageAccountsFromEnv({ ...env, MEDIA_ACCOUNT_3_ID: "cloudinary", MEDIA_ACCOUNT_3_PROVIDER: "cloudinary", MEDIA_ACCOUNT_3_CLOUDINARY_URL: "cloudinary://k:s@moved" });
  assert.deepEqual(accounts.map((account) => account.id), ["cld-2", "r2-main", "cloudinary", "s3-archive"]);
});

test("bad slots are skipped and named by variable, never by value", () => {
  const { accounts, problems } = storageAccountsFromEnv({
    MEDIA_ACCOUNT_1_ID: "Bad Id",
    MEDIA_ACCOUNT_1_PROVIDER: "s3",
    MEDIA_ACCOUNT_2_ID: "r2-x",
    MEDIA_ACCOUNT_2_PROVIDER: "r2",
    MEDIA_ACCOUNT_2_ACCOUNT_ID: "nope",
    MEDIA_ACCOUNT_2_SECRET_ACCESS_KEY: "do-not-print-me",
    MEDIA_ACCOUNT_3_ID: "dup",
    MEDIA_ACCOUNT_3_PROVIDER: "cloudinary",
    MEDIA_ACCOUNT_3_CLOUDINARY_URL: "cloudinary://a:b@c",
    MEDIA_ACCOUNT_5_ID: "dup",
    MEDIA_ACCOUNT_5_PROVIDER: "cloudinary",
    MEDIA_ACCOUNT_5_CLOUDINARY_URL: "cloudinary://a:b@d",
    MEDIA_ACCOUNT_6_ID: "gcs",
    MEDIA_ACCOUNT_6_PROVIDER: "gcs",
  });
  assert.deepEqual(accounts.map((account) => account.id), ["dup"]);
  assert.ok(problems.some((line) => line.startsWith("MEDIA_ACCOUNT_1_ID")));
  assert.ok(problems.some((line) => line.includes("MEDIA_ACCOUNT_2_ACCOUNT_ID")));
  assert.ok(problems.some((line) => line.includes('id "dup" is already used')));
  assert.ok(problems.some((line) => line.startsWith("MEDIA_ACCOUNT_6_PROVIDER")));
  assert.ok(problems.every((line) => !line.includes("do-not-print-me")));
});

test("no more than 10 accounts of one provider are used", () => {
  const many: Record<string, string> = {};
  for (let slot = 1; slot <= 11; slot += 1) {
    many[`MEDIA_ACCOUNT_${slot}_ID`] = `c${slot}`;
    many[`MEDIA_ACCOUNT_${slot}_PROVIDER`] = "cloudinary";
    many[`MEDIA_ACCOUNT_${slot}_CLOUDINARY_URL`] = `cloudinary://k:s@cloud${slot}`;
  }
  const { accounts, problems } = storageAccountsFromEnv(many);
  assert.equal(accounts.length, 10);
  assert.ok(problems.some((line) => line.includes("more than 10 cloudinary")));
});

test("describeAccount never shows a credential", () => {
  const { accounts } = storageAccountsFromEnv(env);
  const shown = JSON.stringify(accounts.map(describeAccount));
  for (const secret of ["legacy-secret", "secret2", "r2-secret", "s3-secret", "legacy-key", "r2-key"]) assert.ok(!shown.includes(secret), secret);
});

test("failures are classified so only a real quota marks an account full", () => {
  assert.equal(classifyFailure("cloudinary", 400, "Your account is over quota"), "quota");
  assert.equal(classifyFailure("cloudinary", 420, "Rate Limit Exceeded"), "rate-limited");
  assert.equal(classifyFailure("cloudinary", 429, ""), "rate-limited");
  assert.equal(classifyFailure("cloudinary", 401, "Invalid Signature"), "auth");
  assert.equal(classifyFailure("cloudinary", 400, "Invalid image file"), "rejected");
  assert.equal(classifyFailure("r2", 403, "<Error><Code>QuotaExceeded</Code></Error>"), "quota");
  assert.equal(classifyFailure("s3", 503, "<Error><Code>SlowDown</Code></Error>"), "rate-limited");
  assert.equal(classifyFailure("s3", 502, ""), "unavailable");
  assert.equal(classifyFailure("s3", null), "unavailable");
});

test("upload candidates skip read-only, full, skipped and over-cap accounts, in order", () => {
  const { accounts } = storageAccountsFromEnv(env);
  const ids = (list: StorageAccount[]) => list.map((account) => account.id);
  assert.deepEqual(ids(uploadCandidates(accounts, 1000)), ["cloudinary", "cld-2", "r2-main"]);
  assert.deepEqual(ids(uploadCandidates(accounts, 1000, { full: new Set(["cloudinary"]), skip: new Set(["cld-2"]) })), ["r2-main"]);
  const nearlyFull = new Map([["r2-main", 10 * 1024 ** 3 - 10]]);
  assert.deepEqual(ids(uploadCandidates(accounts, 1000, { usedBytes: nearlyFull, full: new Set(["cloudinary", "cld-2"]) })), []);
});

test("failover moves past full and busy accounts, marks only the full one, and stops on a rejected file", async () => {
  const { accounts } = storageAccountsFromEnv(env);
  const marked: string[] = [];
  const outcome = await withFailover(
    accounts.slice(0, 3),
    async (account) => {
      if (account.id === "cloudinary") throw new StorageError("quota", "full");
      if (account.id === "cld-2") throw new StorageError("rate-limited", "busy");
      return `stored on ${account.id}`;
    },
    { onFull: (account) => void marked.push(account.id) }
  );
  assert.equal(outcome.account.id, "r2-main");
  assert.equal(outcome.value, "stored on r2-main");
  assert.deepEqual(marked, ["cloudinary"]);

  let attempts = 0;
  await assert.rejects(
    withFailover(accounts, async () => {
      attempts += 1;
      throw new StorageError("rejected", "bad file");
    }),
    (error: unknown) => error instanceof StorageError && error.kind === "rejected"
  );
  assert.equal(attempts, 1, "a rejected file is not retried elsewhere");
  await assert.rejects(withFailover([], async () => "never"), /No storage account can take this file/);
});

const r2 = storageAccountsFromEnv(env).accounts[2] as BucketAccount;
const s3 = storageAccountsFromEnv({ ...env, MEDIA_ACCOUNT_4_READ_ONLY: undefined }).accounts[3] as BucketAccount;

test("object URLs: path style on R2, the bucket host on AWS, the public base for delivery", () => {
  assert.equal(objectApiUrl(r2, "uploads/2026/10/a b.png"), `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/media/uploads/2026/10/a%20b.png`);
  assert.equal(objectApiUrl(s3, "x/y.png"), "https://archive-bucket.s3.eu-west-1.amazonaws.com/x/y.png");
  assert.equal(objectPublicUrl(s3, "x/y.png"), "https://cdn.example.com/archive/x/y.png");
  assert.match(newObjectKey("uploads", "PNG", new Date(Date.UTC(2026, 9, 14))), /^uploads\/2026\/10\/[a-f0-9]{24}\.png$/);
  assert.match(newObjectKey("../../etc", ".p?n g"), /^etc\/\d{4}\/\d{2}\/[a-f0-9]{24}\.png$/);
});

test("a browser upload URL pins the type and size; Content-Length is left to the browser", () => {
  const upload = presignBucketUpload(r2, { key: "uploads/k.png", contentType: "image/png", bytes: 2048 });
  const url = new URL(upload.url);
  assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "content-length;content-type;host");
  assert.deepEqual(upload.headers, { "content-type": "image/png" });
  assert.throws(() => presignBucketUpload(r2, { key: "k", contentType: "image/png", bytes: 0 }), StorageError);
});

test("HEAD, PUT and DELETE are signed, read sizes, and turn errors into kinds", async () => {
  const seen: Array<{ method: string; url: string; auth: string | null }> = [];
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seen.push({ method: init?.method ?? "GET", url: String(url), auth: headers.get("authorization") });
    if (String(url).endsWith("missing.png")) return new Response(null, { status: 404 });
    if (String(url).endsWith("full.png")) return new Response("<Error><Code>QuotaExceeded</Code></Error>", { status: 403 });
    if (init?.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": "2048", "content-type": "image/png" } });
    return new Response(null, { status: init?.method === "DELETE" ? 204 : 200 });
  }) as typeof fetch;

  assert.deepEqual(await headObject(r2, "uploads/k.png", fakeFetch), { bytes: 2048, contentType: "image/png" });
  assert.equal(await headObject(r2, "uploads/missing.png", fakeFetch), null);
  assert.deepEqual(await putObject(r2, "uploads/k.png", new Uint8Array([1, 2, 3]), "image/png", fakeFetch), { url: "https://media.example.com/uploads/k.png", bytes: 3 });
  assert.equal(await deleteObject(r2, "uploads/k.png", fakeFetch), true);
  assert.equal(await deleteObject(r2, "uploads/missing.png", fakeFetch), true, "already gone counts as deleted");
  await assert.rejects(putObject(r2, "uploads/full.png", new Uint8Array([1]), "image/png", fakeFetch), (error: unknown) => error instanceof StorageError && error.kind === "quota");
  assert.ok(seen.every((call) => call.auth?.startsWith("AWS4-HMAC-SHA256 Credential=r2-key/")));

  const down = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  await assert.rejects(headObject(r2, "uploads/k.png", down), (error: unknown) => error instanceof StorageError && error.kind === "unavailable");
});

test("delivery patterns keep a custom port apart from the host", () => {
  const { accounts } = storageAccountsFromEnv({ ...env, MEDIA_ACCOUNT_2_PUBLIC_URL: "https://media.example.com:8443/files" });
  assert.deepEqual(deliveryPatterns(accounts)[2], { hostname: "media.example.com", port: "8443", pathname: "/files/**" });
});

test("a bucket probe tells a missing bucket, refused keys and a write-only key apart", async () => {
  const answer = (status: number, code = "") => (async () => new Response(code ? `<Error><Code>${code}</Code></Error>` : null, { status })) as typeof fetch;
  let listed = "";
  const ok = (async (url: string | URL | Request) => {
    listed = String(url);
    return new Response("<ListBucketResult/>", { status: 200 });
  }) as typeof fetch;
  assert.equal(await probeBucket(r2, ok), "ok");
  assert.equal(listed, `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/media?list-type=2&max-keys=1`);
  assert.equal(await probeBucket(r2, answer(403, "AccessDenied")), "no-list-permission");
  assert.equal(await probeBucket(r2, answer(404, "NoSuchBucket")), "missing-bucket");
  assert.equal(await probeBucket(r2, answer(403, "SignatureDoesNotMatch")), "bad-credentials");
  assert.equal(await probeBucket(r2, answer(503)), "unavailable");
  const down = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  assert.equal(await probeBucket(r2, down), "unavailable");
});
