import { generateImage, type AspectRatio, type ImageConfig } from "@sahan-sac/ai-core/image";

// AI images for a post (featured and inline). Generation comes from
// @sahan-sac/ai-core; where the image is kept is the host's choice, behind
// ImageSink: a media library (Cloudinary plus a database row), object
// storage, or nothing. blog-kit never talks to a storage service itself.

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

export type StoredImage = { ok: true; mediaId: string; url: string } | { ok: false; error: string };

export interface ImageSink {
  storeGenerated(image: GeneratedImage, meta: { alt: string; folder: string }): Promise<StoredImage>;
}

/**
 * On a failed store the generated image comes back too, so the editor can
 * still show it and offer a download or a retry: image calls are billed.
 */
export type BlogImageResult =
  | { ok: true; mediaId: string; url: string }
  | { ok: false; stage: "generate"; error: string }
  | { ok: false; stage: "store"; error: string; image: GeneratedImage };

export interface BlogImageOptions {
  alt: string;
  folder: string;
  aspectRatio: AspectRatio;
  signal?: AbortSignal;
}

export interface BlogImageDeps {
  config: ImageConfig;
  sink: ImageSink;
  /** Defaults to ai-core's generateImage; tests pass a fake. */
  generate?: typeof generateImage;
}

export async function generateBlogImage(prompt: string, options: BlogImageOptions, deps: BlogImageDeps): Promise<BlogImageResult> {
  const generate = deps.generate ?? generateImage;
  const outcome = await generate(prompt, deps.config, { aspectRatio: options.aspectRatio, signal: options.signal });
  if (!outcome.ok) return { ok: false, stage: "generate", error: outcome.error };

  const image = { base64: outcome.base64, mimeType: outcome.mimeType };
  const stored = await deps.sink.storeGenerated(image, { alt: options.alt, folder: options.folder });
  if (!stored.ok) return { ok: false, stage: "store", error: stored.error, image };
  return { ok: true, mediaId: stored.mediaId, url: stored.url };
}
