import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { ProviderName } from "./types";

// Delivery tracking: one status per sent message, moved forward by provider
// webhooks. Verification and parsing live here; storage stays in the app,
// which keeps one row per message (keyed by provider + providerMessageId) and
// applies nextStatus() to every event. Secrets are parameters, never read
// from the environment here.

export const DELIVERY_STATUSES = [
  "queued",
  "sent",
  "delayed",
  "delivered",
  "opened",
  "clicked",
  "unsubscribed",
  "complained",
  "bounced",
  "blocked",
  "failed",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Higher wins. Equal ranks take the newer event (delayed, then sent again). */
const RANK: Record<DeliveryStatus, number> = {
  queued: 0,
  sent: 1,
  delayed: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
  unsubscribed: 5,
  complained: 6,
  bounced: 6,
  blocked: 6,
  failed: 6,
};

/** The status after `incoming`: an event never moves a message backwards (opened, then a late delivered). */
export function nextStatus(current: DeliveryStatus, incoming: DeliveryStatus): DeliveryStatus {
  return RANK[incoming] >= RANK[current] ? incoming : current;
}

/** True for a status that means the mail did not, or will not, arrive. */
export function isFailureStatus(status: DeliveryStatus): boolean {
  return status === "bounced" || status === "blocked" || status === "failed" || status === "complained";
}

/** One provider event, normalized. `detail` is a short reason, never the body. */
export interface DeliveryEvent {
  provider: Extract<ProviderName, "resend" | "brevo-api">;
  providerMessageId: string;
  status: DeliveryStatus;
  /** The provider's own event name, for the event log. */
  type: string;
  at: Date;
  detail?: string;
  /** The ref tag sent with the message, when the provider echoes it. */
  ref?: string;
}

const MAX_DETAIL = 300;
const shortText = (value: unknown) => (typeof value === "string" && value ? value.slice(0, MAX_DETAIL) : undefined);

/** Constant time, and hashing first means the lengths never leak either. */
function sameSecret(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

function validDate(value: Date): Date {
  return Number.isNaN(value.getTime()) ? new Date() : value;
}

// ── Resend (Svix-signed webhooks) ────────────────────────────────────────────

const RESEND_TOLERANCE_SECONDS = 5 * 60;

/**
 * Verifies a Resend webhook. Resend signs with Svix: HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${rawBody}`, keyed with the base64 part of
 * the `whsec_` secret; `svix-signature` lists `v1,<base64>` entries. A
 * timestamp more than five minutes away is rejected, so a captured request
 * cannot be replayed later.
 */
export function verifyResendWebhook(input: {
  secret: string;
  rawBody: string;
  headers: { get(name: string): string | null };
  now?: Date;
}): boolean {
  const id = input.headers.get("svix-id");
  const timestamp = input.headers.get("svix-timestamp");
  const signatures = input.headers.get("svix-signature");
  if (!id || !timestamp || !signatures || !/^\d{1,12}$/.test(timestamp)) return false;
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - Number(timestamp)) > RESEND_TOLERANCE_SECONDS) return false;

  const key = Buffer.from(input.secret.replace(/^whsec_/, ""), "base64");
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${input.rawBody}`).digest("base64");
  return signatures
    .split(" ")
    .map((entry) => entry.split(","))
    .some(([version, signature]) => version === "v1" && signature !== undefined && sameSecret(signature, expected));
}

const RESEND_STATUS: Record<string, DeliveryStatus> = {
  "email.scheduled": "queued",
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.complained": "complained",
  "email.bounced": "bounced",
  "email.failed": "failed",
  "email.suppressed": "blocked",
};

/** Resend's `tags` arrive as `{ name: value }` or `[{ name, value }]`. */
function resendRef(tags: unknown): string | undefined {
  if (Array.isArray(tags)) {
    const tag = tags.find((item) => (item as { name?: unknown } | null)?.name === "ref") as { value?: unknown } | undefined;
    return typeof tag?.value === "string" ? tag.value : undefined;
  }
  const value = (tags as Record<string, unknown> | null | undefined)?.ref;
  return typeof value === "string" ? value : undefined;
}

/** A verified Resend payload to an event; null for an event that is not about delivery. */
export function parseResendEvent(payload: unknown): DeliveryEvent | null {
  const body = payload as { type?: unknown; created_at?: unknown; data?: Record<string, unknown> } | null;
  const type = typeof body?.type === "string" ? body.type : "";
  const status = RESEND_STATUS[type];
  const data = body?.data ?? {};
  const id = data.email_id;
  if (!status || typeof id !== "string" || !id) return null;
  const bounce = data.bounce as { message?: unknown } | undefined;
  const failed = data.failed as { reason?: unknown } | undefined;
  return {
    provider: "resend",
    providerMessageId: id,
    status,
    type,
    at: validDate(new Date(typeof body?.created_at === "string" ? body.created_at : Date.now())),
    detail: shortText(bounce?.message) ?? shortText(failed?.reason),
    ref: resendRef(data.tags),
  };
}

// ── Brevo (transactional webhooks) ───────────────────────────────────────────

/**
 * Brevo does not sign webhooks. Create the webhook with bearer authentication
 * (`auth: { type: "bearer", token }`) and pass that token here; the request's
 * `Authorization: Bearer <token>` is compared in constant time.
 */
export function verifyBrevoWebhook(input: { token: string; authorization: string | null }): boolean {
  if (!input.token || !input.authorization) return false;
  const match = /^Bearer\s+(.+)$/i.exec(input.authorization.trim());
  return match?.[1] !== undefined && sameSecret(match[1], input.token);
}

const BREVO_STATUS: Record<string, DeliveryStatus> = {
  request: "sent",
  sent: "sent",
  delivered: "delivered",
  deferred: "delayed",
  soft_bounce: "delayed",
  opened: "opened",
  unique_opened: "opened",
  uniqueopened: "opened",
  proxy_open: "opened",
  click: "clicked",
  clicked: "clicked",
  hard_bounce: "bounced",
  invalid_email: "bounced",
  spam: "complained",
  complaint: "complained",
  unsubscribed: "unsubscribed",
  blocked: "blocked",
  error: "failed",
};

/** A Brevo payload to events. Brevo may batch, so an array body gives several. */
export function parseBrevoEvents(payload: unknown): DeliveryEvent[] {
  const items: unknown[] = Array.isArray(payload) ? payload : [payload];
  return items.flatMap((item): DeliveryEvent[] => {
    const body = item as Record<string, unknown> | null;
    const type = typeof body?.event === "string" ? body.event : "";
    const status = BREVO_STATUS[type.toLowerCase().replace(/[\s-]/g, "_")];
    const id = body?.["message-id"] ?? body?.messageId;
    if (!status || typeof id !== "string" || !id) return [];
    const seconds = typeof body?.ts_event === "number" ? body.ts_event : typeof body?.ts === "number" ? body.ts : undefined;
    const tags = Array.isArray(body?.tags) ? (body.tags as unknown[]) : [];
    // The category tag has no colon; the ref tag always does (`invite:<id>`).
    const ref = tags.find((tag): tag is string => typeof tag === "string" && tag.includes(":"));
    return [
      {
        provider: "brevo-api",
        providerMessageId: id,
        status,
        type,
        at: seconds ? validDate(new Date(seconds * 1000)) : new Date(),
        detail: shortText(body?.reason),
        ref,
      },
    ];
  });
}
