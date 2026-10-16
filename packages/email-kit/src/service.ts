import { EmailGuardError, prepareMessage } from "./guards";
import type { ProviderQuota } from "./quota";
import type { Attempt, EmailMessage, EmailProvider, ProviderOutcome, SendResult } from "./types";

// The facade behind sendEmail(): validate, try providers in order, stop at the
// first delivery or at a failure another provider cannot fix, and write one
// audit row (email.sent or email.failed) that never holds the body or an
// address. Every side effect is injected, so the rules are unit tested.

export const PROVIDER_TIMEOUT_MS = 15_000;

/** One row per send. Matches the shape of @sahan-sac/auth-kit's AuditEvent, so an app passes its own audit writer. */
export interface EmailAuditEvent {
  action: "email.sent" | "email.failed";
  actor: { id?: string | null; email?: string | null } | null;
  entityType: "Email";
  meta: Record<string, unknown>;
}

/**
 * One row per send for delivery tracking (see ./tracking). Unlike the audit
 * event it carries the recipient, masked, so a developer can tell sends apart.
 */
export interface DeliveryRecord {
  ok: boolean;
  category: EmailMessage["category"];
  ref?: string;
  provider: SendResult["provider"];
  providerMessageId?: string;
  /** `j***@example.com` for the first recipient. */
  recipient: string;
  recipients: number;
  subject: string;
  errorClass?: string;
  attempts: Attempt[];
}

export interface EmailServiceDeps {
  providers: readonly EmailProvider[];
  audit(event: EmailAuditEvent): Promise<void>;
  /** Skips a provider that reached its daily limit (./quota). */
  quota?: ProviderQuota;
  /** Stores the delivery record. Failures are swallowed: tracking never blocks mail. */
  track?(record: DeliveryRecord): Promise<void>;
  timeoutMs?: number;
  now?: () => number;
}

export interface SendOptions {
  actor?: { id?: string | null; email?: string | null } | null;
}

/** `jane@example.com` to `j***@example.com`. */
export function maskAddress(address: string): string {
  const at = address.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${address[0]}***${address.slice(at)}`;
}

async function withTimeout(promise: Promise<ProviderOutcome>, ms: number): Promise<ProviderOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ProviderOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, errorClass: "timeout", retryable: true }), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function createEmailService(deps: EmailServiceDeps) {
  const now = deps.now ?? Date.now;
  const timeoutMs = deps.timeoutMs ?? PROVIDER_TIMEOUT_MS;

  async function record(
    message: EmailMessage,
    result: SendResult,
    recipients: number,
    options: SendOptions
  ): Promise<void> {
    await deps
      .audit({
        action: result.ok ? "email.sent" : "email.failed",
        actor: options.actor ?? null,
        entityType: "Email",
        meta: {
          category: message.category,
          provider: result.provider,
          messageId: result.messageId,
          errorClass: result.errorClass,
          recipients,
          attempts: result.attempts.map(({ provider, ok, errorClass, status }) => ({
            provider,
            ok,
            errorClass,
            status,
          })),
        },
      })
      .catch(() => undefined);
  }

  async function send(message: EmailMessage, options: SendOptions = {}): Promise<SendResult> {
    let prepared;
    try {
      prepared = prepareMessage(message);
    } catch (error) {
      if (!(error instanceof EmailGuardError)) throw error;
      const rejected: SendResult = { ok: false, provider: null, errorClass: error.errorClass, attempts: [] };
      await record(message, rejected, 0, options);
      return rejected;
    }
    const recipients = prepared.to.length + prepared.cc.length + prepared.bcc.length;

    if (deps.providers.length === 0) {
      const none: SendResult = { ok: false, provider: null, errorClass: "no_provider", attempts: [] };
      await record(message, none, recipients, options);
      return none;
    }

    const attempts: Attempt[] = [];
    let result: SendResult | null = null;

    for (const provider of deps.providers) {
      if (deps.quota && !(await deps.quota.allow(provider.name).catch(() => true))) {
        attempts.push({ provider: provider.name, ok: false, errorClass: "quota_reached", ms: 0 });
        continue;
      }
      const started = now();
      let outcome: ProviderOutcome;
      try {
        outcome = await withTimeout(provider.send(prepared), timeoutMs);
      } catch {
        outcome = { ok: false, errorClass: "transport", retryable: true };
      }
      const ms = now() - started;

      if (outcome.ok) {
        await deps.quota?.record(provider.name).catch(() => undefined);
        attempts.push({ provider: provider.name, ok: true, messageId: outcome.messageId, ms });
        result = { ok: true, provider: provider.name, messageId: outcome.messageId, attempts };
        break;
      }
      attempts.push({ provider: provider.name, ok: false, errorClass: outcome.errorClass, status: outcome.status, ms });
      // A failure about the message itself would fail everywhere; do not retry it.
      if (!outcome.retryable) break;
    }

    const final: SendResult = result ?? {
      ok: false,
      provider: null,
      errorClass: attempts[attempts.length - 1]?.errorClass,
      attempts,
    };
    await record(message, final, recipients, options);
    if (deps.track) {
      await deps
        .track({
          ok: final.ok,
          category: prepared.category,
          ref: prepared.ref,
          provider: final.provider,
          providerMessageId: final.messageId,
          recipient: maskAddress(prepared.to[0] ?? ""),
          recipients,
          subject: prepared.subject,
          errorClass: final.errorClass,
          attempts,
        })
        .catch(() => undefined);
    }
    return final;
  }

  return { send };
}
