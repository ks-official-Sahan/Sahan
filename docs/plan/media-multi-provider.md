# Media: multiple accounts across Cloudinary, S3 and R2

Status: phase 1 (package) and phase 2 (app integration) built. The schema
change was applied to the live database on 2026-10-14, after approval, as
the exact SQL below.

## Goal

Store media on up to 10 Cloudinary accounts, plus up to 10 AWS S3 and 10
Cloudflare R2 buckets, in one priority order. When the first account is
full, a new upload goes to the next one. Every asset records which account
holds it, so serving and deleting it never guesses.

## What the ValoremAdminPanel version taught us

It is the starting point (pure env parser, walk-the-accounts shape, a Redis
"full" snapshot, the account stored per asset, per-call credentials). These
parts were not carried over:

| Problem there | Here |
| --- | --- |
| Account ids are positions, so reordering re-points old assets | Every account has a stable `MEDIA_ACCOUNT_<n>_ID`; the slot number is only the priority |
| A 429 counts as "full", which takes a healthy account out of use | `classifyFailure` only marks full on a real quota error; rate limits just move on |
| Fails over on 401/403 and ambiguous 5xx without saying so | Auth failures move on **and** are reported through `onProblem`, so a broken key gets fixed |
| Deletes fall back across accounts | Delete goes only to the recorded account; nothing ever probes other accounts |
| Global SDK config shared by all requests | Credentials are passed per call; no SDK, no module state |
| "Full" kept only 120 s | Full mark TTL is configurable (default 6 h), and soft caps stop uploads before the provider does |
| Secrets stored in a settings table | Secrets stay in env; the database stores only the account id |
| Usage checked per account per upload (N+1) | One grouped `sum(sizeBytes) by accountId` query, cached |

## Package (phase 1, this PR)

- `accounts`: `storageAccountsFromEnv(env)` returns `{ accounts, problems }`.
  Slots `MEDIA_ACCOUNT_1..30`; legacy `CLOUDINARY_*` becomes id `cloudinary`
  at slot 0 unless a slot claims that id. `describeAccount` and
  `deliveryHosts` are the only views that leave the server.
- `storage`: `classifyFailure`, `StorageError`, `uploadCandidates`,
  `withFailover`. A rejected file stops at once (every account would refuse
  it); quota marks full and moves on; rate-limited, unavailable and auth
  move on.
- `bucket`: `presignBucketUpload` (browser PUT, type and size signed, 300 s),
  `headObject`, `putObject`, `deleteObject`. S3 on AWS uses the bucket host;
  R2 and custom endpoints use path style. Keys are chosen by the server
  (`<folder>/<yyyy>/<mm>/<24 hex>.<ext>`), so a retry elsewhere never
  overwrites a file.
- `sigv4`: header signing and URL presigning, tested against AWS's examples.

## Schema change (phase 2, applied 2026-10-14)

```diff
 enum MediaProvider {
   LOCAL
   CLOUDINARY
+  S3
+  R2
 }

 model MediaAsset {
   provider    MediaProvider @default(CLOUDINARY)
+  // Storage account id (MEDIA_ACCOUNT_<n>_ID); existing rows are the legacy account.
+  accountId   String        @default("cloudinary")
   ...
-  @@unique([provider, publicId])
+  @@unique([provider, accountId, publicId])
+  @@index([accountId])
 }
```

Additive and safe on live data: the new column has a default that matches
every existing row, and the new unique key is wider than the old one, so no
existing row can violate it. Applied as this SQL (`prisma migrate diff`,
reviewed, then `prisma db execute`):

```sql
ALTER TYPE "MediaProvider" ADD VALUE 'S3';
ALTER TYPE "MediaProvider" ADD VALUE 'R2';
DROP INDEX "media_assets_provider_publicId_key";
ALTER TABLE "media_assets" ADD COLUMN "accountId" TEXT NOT NULL DEFAULT 'cloudinary';
CREATE INDEX "media_assets_accountId_idx" ON "media_assets"("accountId");
CREATE UNIQUE INDEX "media_assets_provider_accountId_publicId_key" ON "media_assets"("provider", "accountId", "publicId");
```

Code deployed before this change keeps working against it: it never sets
`accountId` (the default fills it), and its lookups by provider and public
id are plain `WHERE` clauses. Only the media seed's upsert needs the new key.

## App integration (phase 2)

1. **Sign route** picks the first of `uploadCandidates(accounts, size,
   { usedBytes, full, skip })`. Cloudinary returns signed params as today; S3
   and R2 return a presigned PUT. The response carries the account id.
2. **Upload client** sends the file; on any error except a refused file it
   asks the sign route again with `skip=<accountId,...>`, up to 5 accounts.
3. **Register** verifies the file on the named account (Cloudinary
   `getAsset`, bucket `headObject`), and takes the real size from there,
   never from the browser.
4. **Delete** goes to `asset.accountId` only. An unknown account (removed
   from env) leaves the file and logs it; the row is still removed.
5. **Generated images** use `withFailover` with `putObject` or a Cloudinary
   upload.
6. **Full marks** live in Redis (`media:full:<id>`, TTL `MEDIA_FULL_TTL_S`),
   with an in-memory fallback.
7. **Usage** is one `groupBy accountId sum(sizeBytes)`, cached 5 minutes and
   dropped on upload or delete.
8. **Delivery hosts** from `deliveryHosts()` feed `images.remotePatterns` and
   the CSP `img-src`.
9. **Integrations page** lists accounts (`describeAccount`), usage against
   caps, full marks and env `problems`.

## Later (phase 3)

Circuit breaker per account, quota reservation for parallel uploads,
reordering from the admin panel (stored order overriding slot order), and
moving files between accounts.

## Operator notes

- Reorder by renumbering slots; never change an id that has assets.
- Retire an account with `MEDIA_ACCOUNT_<n>_READ_ONLY=true`: its files still
  serve and delete, and no new upload goes there.
- Buckets need CORS allowing `PUT` from the site origin with the
  `content-type` header, and a public read URL (`_PUBLIC_URL`).
