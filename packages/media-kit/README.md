# @sahan-sac/media-kit

The Cloudinary media layer shared by the app's admin media library: config and format/size rules, HMAC signing for `/media` delivery URLs and Cloudinary uploads, delivery URL transforms, a browser upload client, and a typed `CloudinaryClient` for the Admin API.

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

## Example

```ts
import { mediaEnvFromProcess } from "@sahan-sac/media-kit/env";
import { CloudinaryClient, cloudinaryConfigFromEnv } from "@sahan-sac/media-kit/cloudinary";
import { log } from "@/lib/log"; // any logger with a warn(message, meta) shape

const env = mediaEnvFromProcess();
const config = cloudinaryConfigFromEnv(env);

export const cloudinary = config
  ? new CloudinaryClient({ ...config, onWarn: (message, meta) => log.warn(message, meta) })
  : null;
```

`CloudinaryClient` takes its credentials and an optional `onWarn` as constructor arguments instead of reading `env` or a shared logger — this keeps the package unit-testable without a live secret, and lets an app plug in its own logger. Secrets are never logged; only status codes and truncated error text reach `onWarn`.

`uploadToMediaLibrary(file, register, options)` takes a `register` callback — the app wires this to its own "record this upload" Server Action (folder/type/size re-validation and the `MediaAsset` row stay app-side).
