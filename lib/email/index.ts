import "server-only";

import {
  createCaptureProvider,
  createDailyQuota,
  createEmailService,
  emailConfigFromEnv,
  emailHealth,
  providerOrder,
  runBrevoDiagnostics,
  type BrevoDiagnostics,
  type DiagnosticsInput,
  type EmailConfig,
  type EmailHealth,
  type EmailMessage,
  type EmailProvider,
  type OrderableProvider,
  type QuotaStore,
  type SendOptions,
  type SendResult,
} from "@sahan-sac/email-kit";
import { createBrevoApiProvider } from "@sahan-sac/email-kit/providers/brevo-api";
import { createSmtpProvider } from "@sahan-sac/email-kit/providers/brevo-smtp";
import { createResendProvider } from "@sahan-sac/email-kit/providers/resend";

import { auditSafe } from "@/lib/admin/audit";
import { kv } from "@/lib/cache/redis";
import { repos } from "@/lib/data";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/log";
import { getSetting } from "@/lib/settings/service";

// The one entry point for mail: sendEmail(). Brevo API first, Resend second,
// Brevo SMTP last; the email settings' provider order, then
// EMAIL_PROVIDER_ORDER, can move providers to the front. Chosen on every call,
// so a changed setting or variable applies to the next send. Every send is
// recorded in email_deliveries and moved forward by the provider webhooks
// (app/api/webhooks/email/*). Providers, guards and the layout live in @sahan-sac/email-kit;
// this file only wires the environment and the audit log.
// docs/plan/admin-cms-adr.md, step 5 and decision D11.

const isProduction = () => process.env.NODE_ENV === "production";

function currentConfig(): EmailConfig {
  return emailConfigFromEnv(getEnv());
}

/** Brevo's free plan allows 300 sends a day; BREVO_DAILY_LIMIT=0 turns the check off. */
const BREVO_FREE_DAILY_LIMIT = 300;

const quotaStore: QuotaStore = {
  increment: (key, ttlSeconds) => kv.incr(key, ttlSeconds),
  get: async (key) => Number((await kv.get<number>(key)) ?? 0),
};

/** The settings' primary and secondary provider, or nothing when unset or unreadable. */
async function preferredOrder(): Promise<OrderableProvider[]> {
  try {
    return (await getSetting("email.routing")).providerOrder ?? [];
  } catch {
    return [];
  }
}

function buildProviders(config: EmailConfig, preferred: readonly OrderableProvider[]): EmailProvider[] {
  return providerOrder(config, isProduction(), preferred).flatMap((name): EmailProvider[] => {
    if (name === "brevo-api" && config.brevoApi) return [createBrevoApiProvider(config.brevoApi)];
    if (name === "resend" && config.resend) return [createResendProvider(config.resend)];
    if (name === "brevo-smtp" && config.smtp) return [createSmtpProvider(config.smtp)];
    if (name === "capture") return [createCaptureProvider(isProduction())];
    return [];
  });
}

/** Sends one message. Never throws for a delivery failure: read `ok` and `attempts`. */
export async function sendEmail(message: EmailMessage, options?: SendOptions): Promise<SendResult> {
  const env = getEnv();
  return createEmailService({
    providers: buildProviders(currentConfig(), await preferredOrder()),
    audit: (event) => auditSafe(event),
    quota: createDailyQuota({ limits: { "brevo-api": env.BREVO_DAILY_LIMIT ?? BREVO_FREE_DAILY_LIMIT }, store: quotaStore }),
    track: async (record) => {
      // capture (tests) never gets a webhook, so it counts as delivered at once.
      const status = !record.ok ? "failed" : record.provider === "capture" ? "delivered" : "sent";
      await repos.emailDeliveries.record({ ...record, status }).catch((error) => {
        log.warn("email delivery not recorded", { error: String(error), category: record.category });
      });
    },
  }).send(message, options);
}

export async function getEmailHealth(): Promise<EmailHealth> {
  const env = getEnv();
  return emailHealth(currentConfig(), {
    production: isProduction(),
    brevoApiKey: Boolean(env.EMAIL_BREVO_API_KEY ?? env.BREVO_API_KEY),
    preferred: await preferredOrder(),
  });
}

/** `"Name" <a@b.cd>` or `a@b.cd` to `a@b.cd`. */
const bareAddress = (mailbox: string | undefined) =>
  mailbox ? (/<([^<>]+)>$/.exec(mailbox)?.[1] ?? mailbox) : null;

export function getBrevoDiagnostics(input: DiagnosticsInput = {}): Promise<BrevoDiagnostics> {
  const env = getEnv();
  return runBrevoDiagnostics(input, {
    apiKey: env.EMAIL_BREVO_API_KEY,
    senderAddress: bareAddress(currentConfig().smtp?.from),
  });
}
