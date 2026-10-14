import { classifyFailure, type FailureKind } from "./storage";

// Browser-side upload into the media library: sign on the server
// (/api/admin/uploads/sign), send the file straight to the storage account it
// picked (Cloudinary, or a presigned PUT to an S3 or R2 bucket), then record
// it by calling the caller-supplied `register` function (the app wires this to
// its registerUpload Server Action, which re-checks folder, type and size on
// that account before creating the MediaAsset row). When an account cannot
// take the file (full, busy, down, or refusing the credentials) the upload
// asks for the next one, skipping each account it already tried; a file the
// account itself refuses stops at once, since every account would refuse it.
// Used by the media picker and by the featured-image card's "upload it
// myself" fallback when a server-side upload of a generated image failed.

export type UploadResult = { ok: true; mediaId: string; url: string } | { ok: false; error: string };

export type RegisterUpload = (
  publicId: string,
  folder: string,
  alt?: string,
  /** The storage account the file went to; omitted means the legacy Cloudinary account. */
  accountId?: string
) => Promise<{ ok: boolean; error?: string; asset?: { id: string; url: string } }>;

type SignResponse = { ok: true; accountId: string; folder: string } & (
  | { provider: "cloudinary"; cloudName: string; apiKey: string; params: Record<string, string>; signature: string }
  | { provider: "s3" | "r2"; key: string; uploadUrl: string; headers: Record<string, string> }
);

type Sent = { ok: true; publicId: string } | { ok: false; kind: FailureKind; error: string };

/** Accounts one upload tries before giving up. */
const MAX_ACCOUNTS_TRIED = 5;

const EXTENSIONS: Record<string, string> = { jpeg: "jpg", "svg+xml": "svg" };

/** A file name with an extension, so the server can check the type before signing. */
function nameFor(file: Blob, given?: string): string {
  const name = given ?? (typeof File !== "undefined" && file instanceof File ? file.name : "");
  if (/\.[a-z0-9]+$/i.test(name)) return name;
  const subtype = file.type.split("/")[1]?.toLowerCase();
  return subtype ? `${name || "upload"}.${EXTENSIONS[subtype] ?? subtype}` : name;
}

async function sendToCloudinary(sign: Extract<SignResponse, { provider: "cloudinary" }>, file: Blob, fileName: string): Promise<Sent> {
  const form = new FormData();
  form.append("file", file, fileName || "upload");
  form.append("api_key", sign.apiKey);
  for (const [key, value] of Object.entries(sign.params)) form.append(key, value);
  form.append("signature", sign.signature);

  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(sign.cloudName)}/auto/upload`, { method: "POST", body: form });
  } catch {
    return { ok: false, kind: "unavailable", error: "The media store did not answer." };
  }
  const body = (await response.json().catch(() => null)) as { public_id?: string; error?: { message?: string } } | null;
  if (response.ok && body?.public_id) return { ok: true, publicId: body.public_id };
  const message = body?.error?.message ?? "";
  return { ok: false, kind: classifyFailure("cloudinary", response.status, message), error: message ? `Upload failed: ${message}` : "Upload failed." };
}

async function sendToBucket(sign: Extract<SignResponse, { provider: "s3" | "r2" }>, file: Blob): Promise<Sent> {
  let response: Response;
  try {
    response = await fetch(sign.uploadUrl, { method: "PUT", headers: sign.headers, body: file });
  } catch {
    // Also what a bucket without a CORS rule for this site looks like.
    return { ok: false, kind: "unavailable", error: "The media store did not answer." };
  }
  if (response.ok) return { ok: true, publicId: sign.key };
  const body = await response.text().catch(() => "");
  return { ok: false, kind: classifyFailure(sign.provider, response.status, body), error: `Upload failed (${response.status}).` };
}

export async function uploadToMediaLibrary(
  file: Blob,
  register: RegisterUpload,
  options: { fileName?: string; alt?: string } = {}
): Promise<UploadResult> {
  const fileName = nameFor(file, options.fileName);
  const tried: string[] = [];
  let lastError = "Upload failed.";
  try {
    while (tried.length < MAX_ACCOUNTS_TRIED) {
      const query = new URLSearchParams();
      if (fileName) query.set("name", fileName);
      query.set("size", String(file.size));
      if (tried.length > 0) query.set("skip", tried.join(","));
      const signResponse = await fetch(`/api/admin/uploads/sign?${query}`);
      const sign = (await signResponse.json().catch(() => null)) as (SignResponse | { ok: false; error?: string }) | null;
      if (!signResponse.ok || !sign?.ok) {
        const refused = sign && !sign.ok ? sign.error : undefined;
        return { ok: false, error: tried.length > 0 ? `${lastError} ${refused ?? ""}`.trim() : (refused ?? "Could not start the upload.") };
      }

      const sent = sign.provider === "cloudinary" ? await sendToCloudinary(sign, file, fileName) : await sendToBucket(sign, file);
      if (sent.ok) {
        const registered = await register(sent.publicId, sign.folder, options.alt, sign.accountId);
        if (!registered.ok || !registered.asset) return { ok: false, error: registered.error || "The upload could not be recorded." };
        return { ok: true, mediaId: registered.asset.id, url: registered.asset.url };
      }
      if (sent.kind === "rejected") return { ok: false, error: sent.error };
      lastError = sent.error;
      tried.push(sign.accountId);
    }
    return { ok: false, error: lastError };
  } catch {
    return { ok: false, error: "The upload could not reach the server." };
  }
}

/**
 * Base64 image bytes as a Blob, for re-uploading an image the browser already
 * holds. Decoded by hand: fetch(dataUrl) would be blocked by the CSP's
 * connect-src, which does not allow data:.
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
