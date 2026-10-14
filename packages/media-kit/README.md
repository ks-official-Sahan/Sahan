# @sahan-sac/media-kit

The media layer (Cloudinary, AWS S3 and Cloudflare R2) shared by the app's admin media library: config and format/size rules, HMAC signing for `/media` delivery URLs and Cloudinary uploads, delivery URL transforms, a browser upload client, and a typed `CloudinaryClient` for the Admin API.

Headless and framework-agnostic: no Prisma, no database access, no Next.js APIs. Everything takes a parsed env or config object; only `mediaEnvFromProcess()` reads `process.env`. The DB-backed service (`MediaAsset` rows, audit trail) stays in the app at `lib/media/service.ts`.

## Subpaths

| Import | What |
| --- | --- |
| `@sahan-sac/media-kit/env` | `mediaEnvSchema` (zod), `parseMediaEnv(source)`, `mediaEnvFromProcess()`, `MediaEnv` |
| `@sahan-sac/media-kit/config` | `MEDIA_CONFIG` (formats, size limits, allowed widths and qualities; the upload folder is your app's own constant), `MediaKind`, `getMediaKind`, `validateMediaFormat`, `getMaxSizeBytes` |
| `@sahan-sac/media-kit/validation` | `validateMediaUpload`, `validateMediaMetadata`, `isAllowedWidth`, `isAllowedQuality` |
| `@sahan-sac/media-kit/signature` | `signMediaUrl`, `verifyMediaSignature`, `signCloudinaryUpload` |
| `@sahan-sac/media-kit/delivery` | `cloudinaryImageUrl`, `cloudinarySrcSet` |
| `@sahan-sac/media-kit/cloudinary` | `CloudinaryClient`, `cloudinaryConfigFromEnv`, `CloudinaryAsset`, `UploadBase64Result` |
| `@sahan-sac/media-kit/upload-client` | `uploadToMediaLibrary`, `base64ToBlob`, `RegisterUpload` |
| `@sahan-sac/media-kit/accounts` | `storageAccountsFromEnv(env)`, `describeAccount`, `deliveryHosts`, `StorageAccount` (Cloudinary, S3 and R2 accounts in priority order) |
| `@sahan-sac/media-kit/storage` | `classifyFailure`, `StorageError`, `uploadCandidates`, `withFailover` |
| `@sahan-sac/media-kit/bucket` | `presignBucketUpload`, `headObject`, `putObject`, `deleteObject`, `newObjectKey`, `objectPublicUrl` (S3 and R2 over `fetch`) |
| `@sahan-sac/media-kit/sigv4` | `signS3Request`, `presignS3Url` (AWS Signature Version 4, no SDK) |

`cloudinary` imports `server-only` (it makes network calls with a secret): use it from server code only. `config`, `validation`, `signature` and `delivery` are pure and import nothing app-specific — `validation` and `config` are safe in the browser, so the media picker can validate a file before it uploads. `upload-client` runs in the browser.

## Environment

Spread the schema into your own env module so the names never drift:

```ts
import { mediaEnvSchema } from "@sahan-sac/media-kit/env";

const schema = z.object({ ...mediaEnvSchema.shape, DATABASE_URL: z.string() });
```

| Variable | Meaning |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary Admin API and upload credentials |
| `CLOUDINARY_URL` | Optional combined Cloudinary connection string, if your deployment sets it instead of the three above |
| `MEDIA_SIGNING_SECRET` | HMAC secret for signed `/media` delivery URLs (`signMediaUrl`/`verifyMediaSignature`) |

## Several storage accounts

Up to 10 accounts each of Cloudinary, AWS S3 and Cloudflare R2, read from numbered env slots. The slot number is the priority; the id is stable and is what each stored asset records, so reordering slots never re-points an old file.

| Variable | Meaning |
| --- | --- |
| `MEDIA_ACCOUNT_<n>_ID` | Stable id, 1-32 lowercase letters, digits or dashes |
| `MEDIA_ACCOUNT_<n>_PROVIDER` | `cloudinary`, `s3` or `r2` |
| `MEDIA_ACCOUNT_<n>_CAP_GB` | Optional soft cap: no new uploads once its recorded files reach it |
| `MEDIA_ACCOUNT_<n>_READ_ONLY` | `true`: serve and delete its files, upload nowhere |
| Cloudinary | `_CLOUDINARY_URL`, or `_CLOUD_NAME`, `_API_KEY`, `_API_SECRET` |
| S3 | `_BUCKET`, `_REGION`, `_ACCESS_KEY_ID`, `_SECRET_ACCESS_KEY`, `_PUBLIC_URL`, optional `_ENDPOINT` |
| R2 | `_ACCOUNT_ID`, `_BUCKET`, `_ACCESS_KEY_ID`, `_SECRET_ACCESS_KEY`, `_PUBLIC_URL` |

The single-account `CLOUDINARY_*` variables still work and become account `cloudinary`, ahead of every slot.

```ts
import { storageAccountsFromEnv } from "@sahan-sac/media-kit/accounts";
import { putObject, newObjectKey } from "@sahan-sac/media-kit/bucket";
import { uploadCandidates, withFailover } from "@sahan-sac/media-kit/storage";

const { accounts, problems } = storageAccountsFromEnv(process.env);
const candidates = uploadCandidates(accounts, bytes.byteLength, { usedBytes, full });
const { account, value } = await withFailover(
  candidates,
  async (account) => {
    if (account.provider === "cloudinary") return uploadToCloudinary(account, bytes);
    return putObject(account, newObjectKey("uploads", "webp"), bytes, "image/webp");
  },
  { onFull: (account) => markFull(account.id) }
);
// Store account.id with the asset; serve and delete it from that account only.
```

Only a real quota error marks an account full. Rate limits, timeouts and outages move the upload on without marking anything; a refused file stops at once, because every account would refuse it.

## Example

```ts
import { mediaEnvFromProcess } from "@sahan-sac/media-kit/env";
import { CloudinaryClient, cloudinaryConfigFromEnv } from "@sahan-sac/media-kit/cloudinary";

const env = mediaEnvFromProcess();
const config = cloudinaryConfigFromEnv(env);

export const cloudinary = config
  ? new CloudinaryClient({
      ...config,
      onWarn: (message, meta) => console.warn(message, meta),
    })
  : null;
```

`CloudinaryClient` takes its credentials and an optional `onWarn` as constructor arguments instead of reading `env` or a shared logger — this keeps the package unit-testable without a live secret, and lets an app plug in its own logger. Secrets are never logged; only status codes and truncated error text reach `onWarn`.

`uploadToMediaLibrary(file, register, options)` takes a `register` callback — the app wires this to its own "record this upload" Server Action (folder/type/size re-validation and the `MediaAsset` row stay app-side).
