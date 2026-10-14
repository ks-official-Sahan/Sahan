---
"@sahan-sac/media-kit": minor
---

Add multi-provider storage: AWS S3 and Cloudflare R2 next to Cloudinary, up to 10 accounts per provider in one priority order.

- `accounts`: reads numbered `MEDIA_ACCOUNT_<n>_*` env slots (plus the legacy `CLOUDINARY_*` variables) into a typed registry with stable ids, soft caps and read-only accounts; problems are reported by variable name, never by value.
- `storage`: `classifyFailure` sorts provider errors into quota, rate-limited, unavailable, auth and rejected; `uploadCandidates` and `withFailover` move an upload to the next account only when that is safe, and mark an account full only on a real quota error.
- `bucket`: presigned browser uploads plus HEAD, PUT and DELETE for S3 and R2 over plain `fetch`, with per-call credentials and timeouts.
- `sigv4`: dependency-free AWS Signature Version 4 header signing and URL presigning, checked against AWS's published examples.
