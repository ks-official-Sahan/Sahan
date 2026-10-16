import { assertMailbox, EmailGuardError } from "./guards";
import type { EmailEnv } from "./env";
import type { ProviderName } from "./types";

export type OrderableProvider = Exclude<ProviderName, "capture">;

/** auto mode's order when nothing overrides it: Brevo API, then Resend, then Brevo SMTP. */
export const DEFAULT_PROVIDER_ORDER: readonly OrderableProvider[] = ["brevo-api", "resend", "brevo-smtp"];

// Turns environment values into provider settings and decides the order in which
// providers are tried. Pure, so the rules are tested without touching the
// environment.

/** The variables the providers read; `EmailEnv` (./env) parses them. */
export type ProviderEnv = Partial<Pick<EmailEnv, "EMAIL_PROVIDER_ORDER">> &
  Pick<
  EmailEnv,
  | "EMAIL_PROVIDER"
  | "BREVO_API_KEY"
  | "EMAIL_BREVO_API_KEY"
  | "BREVO_SENDER_EMAIL"
  | "BREVO_SENDER_NAME"
  | "RESEND_API_KEY"
  | "RESEND_SENDER_EMAIL"
  | "RESEND_SENDER_NAME"
  | "EMAIL_HOST"
  | "EMAIL_PORT"
  | "EMAIL_USE_TLS"
  | "EMAIL_HOST_USER"
  | "EMAIL_HOST_PASSWORD"
  | "DEFAULT_FROM_EMAIL"
  | "EMAIL_SENDER_USER"
>;

export interface BrevoApiConfig {
  apiKey: string;
  from: string;
}

export interface ResendConfig {
  apiKey: string;
  from: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  /** Implicit TLS (port 465). */
  secure: boolean;
  /** STARTTLS is mandatory (port 587 and other submission ports). */
  requireTLS: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface EmailConfig {
  mode: ProviderEnv["EMAIL_PROVIDER"];
  /** auto mode: providers to try first; the rest follow in DEFAULT_PROVIDER_ORDER. */
  order: OrderableProvider[];
  brevoApi: BrevoApiConfig | null;
  resend: ResendConfig | null;
  smtp: SmtpConfig | null;
  /** Human readable reasons a provider is not usable. Never contains a secret. */
  problems: string[];
}

function mailbox(value: string, label: string, problems: string[]): string | null {
  try {
    return assertMailbox(value, label);
  } catch (error) {
    if (error instanceof EmailGuardError) {
      problems.push(`${label} is not a valid address`);
      return null;
    }
    throw error;
  }
}

export function emailConfigFromEnv(env: ProviderEnv): EmailConfig {
  const problems: string[] = [];

  let resend: ResendConfig | null = null;
  if (env.RESEND_API_KEY && env.RESEND_SENDER_EMAIL) {
    const sender = env.RESEND_SENDER_NAME
      ? `${env.RESEND_SENDER_NAME} <${env.RESEND_SENDER_EMAIL}>`
      : env.RESEND_SENDER_EMAIL;
    const from = mailbox(sender, "RESEND_SENDER_EMAIL", problems);
    if (from) resend = { apiKey: env.RESEND_API_KEY, from };
  } else {
    problems.push("Resend needs RESEND_API_KEY and RESEND_SENDER_EMAIL");
  }

  let brevoApi: BrevoApiConfig | null = null;
  const brevoKey = env.BREVO_API_KEY ?? env.EMAIL_BREVO_API_KEY;
  const brevoFrom = env.BREVO_SENDER_EMAIL ?? env.DEFAULT_FROM_EMAIL ?? env.EMAIL_SENDER_USER;
  if (brevoKey && brevoFrom) {
    const sender = env.BREVO_SENDER_EMAIL && env.BREVO_SENDER_NAME ? `${env.BREVO_SENDER_NAME} <${env.BREVO_SENDER_EMAIL}>` : brevoFrom;
    const from = mailbox(sender, "BREVO_SENDER_EMAIL", problems);
    if (from) brevoApi = { apiKey: brevoKey, from };
  } else if (env.BREVO_API_KEY || env.BREVO_SENDER_EMAIL || env.EMAIL_PROVIDER === "brevo-api" || env.EMAIL_PROVIDER_ORDER?.includes("brevo-api")) {
    // Only worth reporting when the Brevo API is meant to be used: an app that
    // never set it up sends through the other providers.
    problems.push("Brevo API needs BREVO_API_KEY and BREVO_SENDER_EMAIL (or DEFAULT_FROM_EMAIL)");
  }

  let smtp: SmtpConfig | null = null;
  const fromValue = env.DEFAULT_FROM_EMAIL ?? env.EMAIL_SENDER_USER;
  if (env.EMAIL_HOST && env.EMAIL_HOST_USER && env.EMAIL_HOST_PASSWORD && fromValue) {
    const from = mailbox(fromValue, "DEFAULT_FROM_EMAIL", problems);
    const port = env.EMAIL_PORT ?? 587;
    const secure = port === 465;
    if (from) {
      smtp = {
        host: env.EMAIL_HOST,
        port,
        secure,
        requireTLS: !secure && env.EMAIL_USE_TLS,
        user: env.EMAIL_HOST_USER,
        pass: env.EMAIL_HOST_PASSWORD,
        from,
      };
    }
  } else {
    problems.push("SMTP needs EMAIL_HOST, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD and DEFAULT_FROM_EMAIL");
  }

  return { mode: env.EMAIL_PROVIDER, order: env.EMAIL_PROVIDER_ORDER ?? [], brevoApi, resend, smtp, problems };
}

function configured(config: EmailConfig, name: OrderableProvider): boolean {
  if (name === "brevo-api") return config.brevoApi !== null;
  if (name === "resend") return config.resend !== null;
  return config.smtp !== null;
}

/**
 * Providers to try, first to last. `auto` uses every configured provider:
 * `preferred` first (an app setting; it wins over EMAIL_PROVIDER_ORDER), then
 * the rest in DEFAULT_PROVIDER_ORDER, so Brevo SMTP stays the last resort
 * unless named. A single provider name uses only that provider. `capture`
 * (tests) is never returned in production.
 */
export function providerOrder(
  config: EmailConfig,
  production: boolean,
  preferred?: readonly OrderableProvider[]
): ProviderName[] {
  switch (config.mode) {
    case "brevo-api":
    case "resend":
    case "brevo-smtp":
      return configured(config, config.mode) ? [config.mode] : [];
    case "capture":
      return production ? [] : ["capture"];
    case "auto": {
      const first = preferred && preferred.length > 0 ? preferred : config.order;
      return [...new Set([...first, ...DEFAULT_PROVIDER_ORDER])].filter((name) => configured(config, name));
    }
  }
}
