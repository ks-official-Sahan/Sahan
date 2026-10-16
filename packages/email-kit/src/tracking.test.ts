import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import { classifyBrevoError, createBrevoApiProvider, toBrevoMailbox, type FetchLike } from "./providers/brevo-api";
import { createDailyQuota, createMemoryQuotaStore, quotaKey } from "./quota";
import { createEmailService, maskAddress, type DeliveryRecord } from "./service";
import {
  nextStatus,
  parseBrevoEvents,
  parseResendEvent,
  verifyBrevoWebhook,
  verifyResendWebhook,
} from "./tracking";
import type { EmailProvider, PreparedMessage } from "./types";

/** Not a real key: a placeholder the tests look for in output. */
const FAKE_BREVO_KEY = "fake-brevo-key";

const message: PreparedMessage = {
  to: ["jane@example.com"],
  cc: [],
  bcc: [],
  subject: "Hello",
  html: "<p>Hi</p>",
  text: "Hi",
  category: "invite",
  ref: "invite:abc123",
};

function fakeFetch(status: number, body: unknown, calls: { url: string; init: RequestInit }[] = []): FetchLike {
  return async (url, init) => {
    calls.push({ url, init });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  };
}

// ── Brevo API provider ───────────────────────────────────────────────────────

test("brevo-api sends the key in a header only, with tags for category and ref", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const provider = createBrevoApiProvider({ apiKey: FAKE_BREVO_KEY, from: '"Sahan" <mail@example.com>' }, fakeFetch(201, { messageId: "<m1@relay>" }, calls));
  const outcome = await provider.send(message);
  assert.deepEqual(outcome, { ok: true, messageId: "<m1@relay>" });
  const call = calls[0]!;
  assert.equal(call.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal((call.init.headers as Record<string, string>)["api-key"], FAKE_BREVO_KEY);
  const body = JSON.parse(String(call.init.body));
  assert.deepEqual(body.sender, { email: "mail@example.com", name: "Sahan" });
  assert.deepEqual(body.tags, ["invite", "invite:abc123"]);
  assert.equal(String(call.init.body).includes(FAKE_BREVO_KEY), false);
});

test("brevo-api: account errors fall through, message errors stop", async () => {
  assert.equal(classifyBrevoError(402, "not_enough_credits").retryable, true);
  assert.equal(classifyBrevoError(429, undefined).retryable, true);
  assert.equal(classifyBrevoError(401, "unauthorized").retryable, true);
  assert.equal(classifyBrevoError(503, undefined).errorClass, "brevo_http_503");
  assert.deepEqual(classifyBrevoError(400, "invalid_parameter"), { ok: false, errorClass: "brevo_invalid_parameter", retryable: false, status: 400 });

  const failing = createBrevoApiProvider({ apiKey: FAKE_BREVO_KEY, from: "mail@example.com" }, fakeFetch(402, { code: "not_enough_credits" }));
  assert.deepEqual(await failing.send(message), { ok: false, errorClass: "brevo_not_enough_credits", retryable: true, status: 402 });

  const offline = createBrevoApiProvider({ apiKey: FAKE_BREVO_KEY, from: "mail@example.com" }, async () => {
    throw new Error("ECONNRESET");
  });
  assert.deepEqual(await offline.send(message), { ok: false, errorClass: "brevo_transport", retryable: true });
});

test("toBrevoMailbox splits a display name", () => {
  assert.deepEqual(toBrevoMailbox("a@example.com"), { email: "a@example.com" });
  assert.deepEqual(toBrevoMailbox('"Team" <a@example.com>'), { email: "a@example.com", name: "Team" });
});

// ── Quota and the service ────────────────────────────────────────────────────

const ok = (name: EmailProvider["name"], id: string): EmailProvider => ({ name, send: async () => ({ ok: true, messageId: id }) });

test("a provider at its daily limit is skipped for the next one", async () => {
  const store = createMemoryQuotaStore();
  const day = new Date("2026-10-16T12:00:00Z");
  const quota = createDailyQuota({ limits: { "brevo-api": 1 }, store, now: () => day });
  const tracked: DeliveryRecord[] = [];
  const svc = createEmailService({
    providers: [ok("brevo-api", "b1"), ok("resend", "r1")],
    audit: async () => undefined,
    quota,
    track: async (record) => {
      tracked.push(record);
    },
  });
  const send = () => svc.send({ to: "jane@example.com", subject: "Hi", html: "<p>x</p>", text: "x", category: "invite", ref: "invite:1" });

  assert.equal((await send()).provider, "brevo-api");
  const second = await send();
  assert.equal(second.provider, "resend");
  assert.equal(second.attempts[0]?.errorClass, "quota_reached");
  assert.equal(await store.get(quotaKey("brevo-api", day)), 1);
  assert.deepEqual(
    tracked.map(({ provider, providerMessageId, recipient, ref }) => ({ provider, providerMessageId, recipient, ref })),
    [
      { provider: "brevo-api", providerMessageId: "b1", recipient: "j***@example.com", ref: "invite:1" },
      { provider: "resend", providerMessageId: "r1", recipient: "j***@example.com", ref: "invite:1" },
    ]
  );
});

test("a broken tracker or quota store never blocks mail", async () => {
  const svc = createEmailService({
    providers: [ok("resend", "r1")],
    audit: async () => undefined,
    quota: { allow: async () => Promise.reject(new Error("redis down")), record: async () => Promise.reject(new Error("redis down")) },
    track: async () => Promise.reject(new Error("db down")),
  });
  const result = await svc.send({ to: "a@example.com", subject: "Hi", html: "x", text: "x", category: "test" });
  assert.equal(result.ok, true);
});

test("a ref with unsafe characters is refused before any provider", async () => {
  let called = false;
  const svc = createEmailService({
    providers: [
      {
        name: "resend",
        send: async () => {
          called = true;
          return { ok: true };
        },
      },
    ],
    audit: async () => undefined,
  });
  const result = await svc.send({ to: "a@example.com", subject: "Hi", html: "x", text: "x", category: "test", ref: "invite:1\r\nBcc: x" });
  assert.deepEqual([result.ok, result.errorClass, called], [false, "bad_ref", false]);
});

test("maskAddress keeps the first letter and the domain", () => {
  assert.equal(maskAddress("jane@example.com"), "j***@example.com");
  assert.equal(maskAddress("nope"), "***");
});

// ── Status rules ─────────────────────────────────────────────────────────────

test("nextStatus never moves backwards, and a complaint after an open wins", () => {
  assert.equal(nextStatus("opened", "delivered"), "opened");
  assert.equal(nextStatus("delivered", "opened"), "opened");
  assert.equal(nextStatus("opened", "complained"), "complained");
  assert.equal(nextStatus("delayed", "sent"), "sent");
  assert.equal(nextStatus("queued", "bounced"), "bounced");
});

// ── Resend webhooks ──────────────────────────────────────────────────────────

const SECRET_BYTES = Buffer.from("not-a-real-webhook-secret");
const RESEND_SECRET = `whsec_${SECRET_BYTES.toString("base64")}`;

function signed(body: string, timestamp: number, id = "msg_1") {
  const signature = createHmac("sha256", SECRET_BYTES).update(`${id}.${timestamp}.${body}`).digest("base64");
  return new Headers({ "svix-id": id, "svix-timestamp": String(timestamp), "svix-signature": `v1,bogus v1,${signature}` });
}

test("verifyResendWebhook accepts a fresh Svix signature and rejects tampering or replay", () => {
  const body = JSON.stringify({ type: "email.delivered" });
  const now = new Date("2026-10-16T12:00:00Z");
  const ts = Math.floor(now.getTime() / 1000);
  assert.equal(verifyResendWebhook({ secret: RESEND_SECRET, rawBody: body, headers: signed(body, ts), now }), true);
  assert.equal(verifyResendWebhook({ secret: RESEND_SECRET, rawBody: `${body} `, headers: signed(body, ts), now }), false);
  assert.equal(verifyResendWebhook({ secret: RESEND_SECRET, rawBody: body, headers: signed(body, ts - 600), now }), false);
  assert.equal(verifyResendWebhook({ secret: "whsec_", rawBody: body, headers: signed(body, ts), now }), false);
  assert.equal(verifyResendWebhook({ secret: RESEND_SECRET, rawBody: body, headers: new Headers(), now }), false);
});

test("parseResendEvent maps types, keeps the bounce reason and the ref tag", () => {
  const event = parseResendEvent({
    type: "email.bounced",
    created_at: "2026-10-16T12:00:00.000Z",
    data: { email_id: "re_1", tags: { category: "invite", ref: "invite_abc" }, bounce: { message: "Mailbox does not exist" } },
  });
  assert.deepEqual(event, {
    provider: "resend",
    providerMessageId: "re_1",
    status: "bounced",
    type: "email.bounced",
    at: new Date("2026-10-16T12:00:00.000Z"),
    detail: "Mailbox does not exist",
    ref: "invite_abc",
  });
  assert.equal(parseResendEvent({ type: "contact.created", data: { email_id: "re_1" } }), null);
  assert.equal(parseResendEvent({ type: "email.sent", data: {} }), null);
});

// ── Brevo webhooks ───────────────────────────────────────────────────────────

test("verifyBrevoWebhook checks the bearer token", () => {
  assert.equal(verifyBrevoWebhook({ token: "fake-token", authorization: "Bearer fake-token" }), true);
  assert.equal(verifyBrevoWebhook({ token: "fake-token", authorization: "Bearer other" }), false);
  assert.equal(verifyBrevoWebhook({ token: "fake-token", authorization: null }), false);
  assert.equal(verifyBrevoWebhook({ token: "", authorization: "Bearer " }), false);
});

test("parseBrevoEvents handles one event or a batch, and finds the ref tag", () => {
  const events = parseBrevoEvents([
    { event: "delivered", "message-id": "<m1@relay>", ts_event: 1792152000, tags: ["invite", "invite:abc"] },
    { event: "hard_bounce", "message-id": "<m2@relay>", reason: "unknown user" },
    { event: "list_addition", "message-id": "<m3@relay>" },
  ]);
  assert.deepEqual(
    events.map(({ providerMessageId, status, ref, detail }) => ({ providerMessageId, status, ref, detail })),
    [
      { providerMessageId: "<m1@relay>", status: "delivered", ref: "invite:abc", detail: undefined },
      { providerMessageId: "<m2@relay>", status: "bounced", ref: undefined, detail: "unknown user" },
    ]
  );
  assert.equal(events[0]?.at.getTime(), 1792152000 * 1000);
  assert.equal(parseBrevoEvents({ event: "unique_opened", "message-id": "<m4@relay>" })[0]?.status, "opened");
});
