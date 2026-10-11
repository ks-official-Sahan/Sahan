import "server-only";

import { cloudinary } from "@/lib/media/cloudinary-client";

/** The stored file behind a trashed media snapshot, if it has one to delete. */
export function trashedPublicId(data: unknown): string | null {
  const asset = (data as { asset?: { provider?: string; publicId?: string | null } } | null)?.asset;
  return asset?.provider === "CLOUDINARY" && asset.publicId ? asset.publicId : null;
}

/** Deletes a purged asset's Cloudinary file. Throws when Cloudinary refuses. */
export async function deleteTrashedFile(publicId: string): Promise<void> {
  await cloudinary.deleteAsset(publicId);
}
