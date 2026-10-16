import { z } from "zod";

// The email environment, shared by every app that uses email-kit, so a
// variable means the same thing everywhere. Apps spread `emailEnvSchema.shape`
// into their own schema (names can never drift); anything else can call
// parseEmailEnv()/emailEnvFromProcess(). Error messages name variables, never
// values.

const text = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const flag = z
  .string()
  .optional()
  .transform((value) => ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase()));

/** Comma separated, trimmed, empty entries dropped. */
const list = text.transform((value) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
);

const port = text.transform((value, ctx) => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    ctx.addIssue({ code: "custom", message: "must be a port number" });
    return z.NEVER;
  }
  return parsed;
});

export const EMAIL_PROVIDERS = ["auto", "brevo-api", "resend", "brevo-smtp", "capture"] as const;

/** Providers that can appear in EMAIL_PROVIDER_ORDER (capture is for tests only). */
export const ORDERABLE_PROVIDERS = ["brevo-api", "resend", "brevo-smtp"] as const;

const order = list.pipe(z.array(z.enum(ORDERABLE_PROVIDERS)));

/** A positive whole number, or undefined. */
const count = text.transform((value, ctx) => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    ctx.addIssue({ code: "custom", message: "must be a whole number" });
    return z.NEVER;
  }
  return parsed;
});

const provider = text.transform((value) => (value ?? "auto").toLowerCase()).pipe(z.enum(EMAIL_PROVIDERS));

export const emailEnvSchema = z.object({
  /**
   * auto (every configured provider: Brevo API, then Resend, then Brevo SMTP),
   * one provider name to use only that one, or capture (tests; refused in production).
   */
  EMAIL_PROVIDER: provider,
  /**
   * auto mode only: providers to try first, comma separated, such as
   * "resend,brevo-api". Configured providers left out follow in the default order.
   */
  EMAIL_PROVIDER_ORDER: order,
  /** Brevo transactional API key. Falls back to EMAIL_BREVO_API_KEY. */
  BREVO_API_KEY: text,
  /** Sender for the Brevo API; must be a verified Brevo sender. Falls back to DEFAULT_FROM_EMAIL. */
  BREVO_SENDER_EMAIL: text,
  BREVO_SENDER_NAME: text,
  /** Sends per UTC day before the Brevo API is skipped for the next provider. Default 300 (free plan); 0 turns the check off. */
  BREVO_DAILY_LIMIT: count,
  RESEND_API_KEY: text,
  RESEND_SENDER_EMAIL: text,
  RESEND_SENDER_NAME: text,
  EMAIL_HOST: text,
  EMAIL_PORT: port,
  EMAIL_USE_TLS: flag,
  EMAIL_HOST_USER: text,
  EMAIL_HOST_PASSWORD: text,
  DEFAULT_FROM_EMAIL: text,
  EMAIL_SENDER_USER: text,
  /** Resend webhook signing secret (whsec_...), for delivery tracking. */
  RESEND_WEBHOOK_SECRET: text,
  /** Bearer token set on the Brevo transactional webhook, for delivery tracking. */
  BREVO_WEBHOOK_TOKEN: text,
  /** Read only: Brevo delivery diagnostics. */
  EMAIL_BREVO_API_KEY: text,
  /** Addresses that get a redacted copy of account emails (invites, resets): the copy never carries the link. */
  EMAIL_CC: list,
});

export type EmailEnv = z.infer<typeof emailEnvSchema>;

export type EnvSource = Record<string, string | undefined>;

/** Parses the email variables; throws naming the bad variables, never their values. */
export function parseEmailEnv(source: EnvSource): EmailEnv {
  const result = emailEnvSchema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "?")))];
    throw new Error(`Invalid email environment variables: ${names.join(", ")}`);
  }
  return result.data;
}

/** Convenience for apps without their own env module: reads process.env. */
export function emailEnvFromProcess(): EmailEnv {
  return parseEmailEnv(process.env);
}

/**
 * Problems that must stop a production start, by variable name: `capture`
 * would swallow real mail and report success. Empty when fine.
 */
export function emailProductionProblems(env: Pick<EmailEnv, "EMAIL_PROVIDER">): string[] {
  return env.EMAIL_PROVIDER === "capture" ? ['EMAIL_PROVIDER must not be "capture" in production'] : [];
}
