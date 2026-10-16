---
"@sahan-sac/media-kit": patch
---

`CloudinaryClient.getAsset` now calls `resources/image/upload/<public_id>`. It called `resources/image/<public_id>`, which Cloudinary answers with 404, so every lookup returned null and direct uploads to a Cloudinary account could not be confirmed.
