import type { BrevoApiConfig } from "../config";
import type { EmailProvider, PreparedMessage, ProviderOutcome } from "../types";

// Brevo's transactional HTTP API (POST /v3/smtp/email). Plain fetch, no SDK.
// The key goes into the `api-key` header and nowhere else. The category and
// the message's ref travel as tags, so Brevo's webhook events can be matched
// to the app's own records (see ../tracking).

export const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

interface Mailbox {
  email: string;
  name?: string;
}

/** `"Name" <a@b.cd>` or `a@b.cd` to Brevo's `{ email, name }`. */
export function toBrevoMailbox(mailbox: string): Mailbox {
  const match = /^\s*"?([^"<]*?)"?\s*<([^<>]+)>\s*$/.exec(mailbox);
  if (!match) return { email: mailbox.trim() };
  const name = match[1]?.trim();
  const email = (match[2] ?? "").trim();
  return name ? { email, name } : { email };
}

/** Brevo error codes that concern the account or sender, where another provider can still deliver. */
const ACCOUNT_LEVEL = new Set(["unauthorized", "not_enough_credits", "permission_denied", "account_under_validation"]);

/**
 * Maps a Brevo error answer to an outcome. Account-level failures (bad key,
 * no credits, rate limit, sender not allowed) let the next provider try; a
 * malformed message would fail everywhere, so it stops the chain.
 */
export function classifyBrevoError(status: number, code: string | undefined): Extract<ProviderOutcome, { ok: false }> {
  const retryable =
    status >= 500 || status === 401 || status === 402 || status === 403 || status === 429 || (code !== undefined && ACCOUNT_LEVEL.has(code));
  return { ok: false, errorClass: code ? `brevo_${code}` : `brevo_http_${status}`, retryable, status };
}

export function createBrevoApiProvider(config: BrevoApiConfig, fetchImpl: FetchLike = fetch): EmailProvider {
  return {
    name: "brevo-api",
    async send(message: PreparedMessage): Promise<ProviderOutcome> {
      const body = {
        sender: toBrevoMailbox(config.from),
        to: message.to.map((email) => ({ email })),
        ...(message.cc.length ? { cc: message.cc.map((email) => ({ email })) } : {}),
        ...(message.bcc.length ? { bcc: message.bcc.map((email) => ({ email })) } : {}),
        ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
        tags: [message.category, ...(message.ref ? [message.ref] : [])],
      };
      let response: Response;
      try {
        response = await fetchImpl(BREVO_API_URL, {
          method: "POST",
          headers: { "api-key": config.apiKey, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        // Network failure, DNS, TLS: nothing reached Brevo.
        return { ok: false, errorClass: "brevo_transport", retryable: true };
      }
      let payload: { messageId?: unknown; code?: unknown } = {};
      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        // Empty or non-JSON body: the status code alone decides.
      }
      if (!response.ok) {
        return classifyBrevoError(response.status, typeof payload.code === "string" ? payload.code : undefined);
      }
      return { ok: true, messageId: typeof payload.messageId === "string" ? payload.messageId : undefined };
    },
  };
}
