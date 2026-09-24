import "server-only";

import type { AppEnv } from "@/lib/env";

import { getVertexAccessToken } from "./vertex";

// AI image generation for the blog generator (featured image + inline
// content images). No image-capable key is configured anywhere else in this
// repo (app/api/admin/ai/cover/route.ts only ever produced a *text* prompt),
// so this reuses the Vertex AI service account already wired for text
// generation in lib/ai/vertex.ts / lib/ai/providers.ts's vertexProvider —
// same auth, same GOOGLE_CLOUD_PROJECT, just a different model (Imagen
// instead of Gemini) and the :predict endpoint instead of :generateContent.
// Degrades by design: imageGenerationAvailable() lets a caller skip straight
// to "leave a placeholder" when the service account isn't configured, and
// generateImage() itself never throws — a transport or API failure comes
// back as { ok: false }, same shape as an unavailable configuration.

export interface VertexImageConfig {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
  project: string;
  location?: string;
  model?: string;
}

export type ImageOutcome = { ok: true; base64: string; mimeType: string } | { ok: false; error: string };

const DEFAULT_MODEL = "imagen-3.0-generate-002";
const DEFAULT_LOCATION = "us-central1";

/** Shape tolerance: different Imagen model versions have returned the image under slightly different keys. */
function extractPrediction(data: unknown): { bytesBase64Encoded?: string; mimeType?: string } | undefined {
  const predictions = (data as { predictions?: unknown[] })?.predictions;
  const first = Array.isArray(predictions) ? predictions[0] : undefined;
  if (!first || typeof first !== "object") return undefined;
  return first as { bytesBase64Encoded?: string; mimeType?: string };
}

export async function generateImageVertex(
  prompt: string,
  config: VertexImageConfig,
  options: { aspectRatio?: "1:1" | "16:9" | "4:3"; signal?: AbortSignal; fetchImpl?: typeof fetch } = {}
): Promise<ImageOutcome> {
  const location = config.location ?? DEFAULT_LOCATION;
  const model = config.model || DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const accessToken = await getVertexAccessToken(
      { clientEmail: config.clientEmail, privateKey: config.privateKey, tokenUri: config.tokenUri },
      fetchImpl
    );

    const response = await fetchImpl(
      `https://${location}-aiplatform.googleapis.com/v1/projects/${config.project}/locations/${location}/publishers/google/models/${model}:predict`,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        signal: options.signal,
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: options.aspectRatio ?? "16:9",
            // No people-focused portrait generation for a software-engineering blog; keep it conservative.
            safetySetting: "block_medium_and_above",
            personGeneration: "allow_adult",
          },
        }),
      }
    );

    if (!response.ok) {
      return { ok: false, error: `Image provider responded with HTTP ${response.status}` };
    }
    const data = await response.json();
    const prediction = extractPrediction(data);
    if (!prediction?.bytesBase64Encoded) {
      return { ok: false, error: "Image provider returned no image data." };
    }
    return { ok: true, base64: prediction.bytesBase64Encoded, mimeType: prediction.mimeType || "image/png" };
  } catch (error) {
    return { ok: false, error: options.signal?.aborted ? "Image generation timed out." : `Image generation failed: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

/** True when the Vertex service account needed for image generation is configured. */
export function imageGenerationAvailable(env: AppEnv): boolean {
  return Boolean(env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY && env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_TOKEN_URI);
}

export function vertexImageConfigFromEnv(env: AppEnv): VertexImageConfig | null {
  if (!imageGenerationAvailable(env)) return null;
  return {
    clientEmail: env.GOOGLE_CLIENT_EMAIL!,
    privateKey: env.GOOGLE_PRIVATE_KEY!,
    tokenUri: env.GOOGLE_TOKEN_URI!,
    project: env.GOOGLE_CLOUD_PROJECT!,
    model: env.IMAGEN_MODEL,
  };
}
