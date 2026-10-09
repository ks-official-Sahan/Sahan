import { z } from "zod";

// The media environment, shared by every package and app that uses
// media-kit, so a variable means the same thing everywhere. Apps spread
// `mediaEnvSchema.shape` into their own schema (so names can never drift);
// anything else can call parseMediaEnv()/mediaEnvFromProcess(). Error
// messages name variables, never values.

const text = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

export const mediaEnvSchema = z.object({
  CLOUDINARY_CLOUD_NAME: text,
  CLOUDINARY_API_KEY: text,
  CLOUDINARY_API_SECRET: text,
  CLOUDINARY_URL: text,
  MEDIA_SIGNING_SECRET: text,
});

export type MediaEnv = z.infer<typeof mediaEnvSchema>;

export type EnvSource = Record<string, string | undefined>;

/** Parses the media variables; throws naming the bad variables, never their values. */
export function parseMediaEnv(source: EnvSource): MediaEnv {
  const result = mediaEnvSchema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "?")))];
    throw new Error(`Invalid media environment variables: ${names.join(", ")}`);
  }
  return result.data;
}

/** Convenience for apps without their own env module: reads process.env. */
export function mediaEnvFromProcess(): MediaEnv {
  return parseMediaEnv(process.env);
}
