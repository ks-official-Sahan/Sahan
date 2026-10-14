---
"@sahan-sac/media-kit": minor
---

The browser upload client now works with every storage account and fails over between them.

- `uploadToMediaLibrary` sends the file's name and size to the sign route, uploads to whichever account it picks (Cloudinary, or a presigned PUT to an S3 or R2 bucket), and asks for the next account when one is full, busy, down or refusing its keys, up to 5 accounts. A file the account itself refuses is not retried. `RegisterUpload` gets an optional fourth `accountId` argument.
- `config`: `contentTypeFor(format)`, the Content-Type a stored file is served with, chosen from the extension.
- `accounts`: `deliveryPatterns` (for `images.remotePatterns`), `uploadOrigins` (for CSP `connect-src`) and `bucketApiBase`.
- `env`: `MEDIA_FULL_TTL_S`, how long an account that answered "full" is skipped.
