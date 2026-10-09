export type MediaKind = "IMAGE" | "VIDEO" | "DOCUMENT";
export type MediaProvider = "LOCAL" | "CLOUDINARY";

export interface MediaAssetRow {
  id: string;
  provider: MediaProvider;
  kind: MediaKind;
  /** Absolute Cloudinary URL, or a /works/... path for LOCAL assets. */
  url: string;
  publicId: string | null;
  format: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  title: string | null;
  alt: string | null;
  tags: string[];
  folder: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Where an asset is used. */
export interface MediaUsageRow {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
}

export interface MediaPageCursor {
  id: string;
  createdAt: Date;
}

export interface NewMediaAsset {
  provider: MediaProvider;
  kind: MediaKind;
  url: string;
  publicId: string | null;
  format: string;
  width?: number | null;
  height?: number | null;
  sizeBytes: number;
  title?: string | null;
  alt?: string | null;
  folder: string;
  createdById?: string | null;
}

export interface MediaRepo {
  find(id: string): Promise<MediaAssetRow | null>;
  findMany(ids: string[]): Promise<MediaAssetRow[]>;
  findWithUsages(id: string): Promise<(MediaAssetRow & { usages: MediaUsageRow[] }) | null>;
  /** Bounded, newest-first library search. Returns up to `take` rows. */
  listPage(input: { query?: string; kind?: MediaKind; after?: MediaPageCursor; take: number }): Promise<MediaAssetRow[]>;
  /** Newest first. */
  listRecent(limit: number): Promise<MediaAssetRow[]>;
  create(input: NewMediaAsset): Promise<MediaAssetRow>;
  /** Creates the asset unless one with the same provider and publicId exists. */
  createIfMissing(input: NewMediaAsset & { publicId: string }): Promise<void>;
  updateMetadata(id: string, input: { alt: string | null; title: string | null; tags: string[] }): Promise<MediaAssetRow>;
  delete(id: string): Promise<void>;
  /** Records one use; recording the same use twice is a no-op. */
  recordUsage(input: { mediaId: string } & Omit<MediaUsageRow, "id">): Promise<void>;
  /** Records several uses in one statement; already recorded ones are skipped. */
  recordUsages(inputs: Array<{ mediaId: string } & Omit<MediaUsageRow, "id">>): Promise<void>;
  /** Forgets every use by one entity. */
  clearUsage(entityType: string, entityId: string): Promise<void>;
}
