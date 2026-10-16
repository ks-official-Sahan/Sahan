# @sahan-sac/email-kit

Transactional email for server apps, framework-agnostic:

- **Providers with fallback**: the Brevo transactional API (plain fetch),
  Resend over HTTPS, and any SMTP relay (Brevo by default) through
  nodemailer, tried in order: Brevo API, Resend, then SMTP unless you reorder
  them. An account-level failure (bad key, no credits, rate limit) moves to
  the next provider; a failure about the message itself is not retried
  elsewhere. A `capture` provider keeps mail in memory for tests and is
  refused in production.
- **Daily quota** (`createDailyQuota`): skips a provider at its daily limit
  (Brevo's free plan: 300) before the API starts refusing. You supply the
  counter store (Redis `INCR`/`GET`, or `createMemoryQuotaStore()`).
- **Delivery tracking** (`./tracking`): `verifyResendWebhook` (Svix
  signatures, 5-minute replay window), `verifyBrevoWebhook` (bearer token,
  constant time), `parseResendEvent`/`parseBrevoEvents` to one
  `DeliveryEvent` shape, and `nextStatus()`, which never moves a message
  backwards. The service's `track` hook hands you one `DeliveryRecord` per
  send (masked recipient, provider message id, your `ref`); storing it is
  up to you.
- **Guards**: CR/LF header injection, address and mailbox validation, http(s)
  only links, recipient, subject and body limits (`prepareMessage`).
- **Env schema**: spread `emailEnvSchema.shape` into your own zod schema, or
  call `parseEmailEnv(process.env)`. `emailProductionProblems(env)` lists what
  must stop a production start.
- **Health** (`emailHealth`) for a settings screen: provider order, what is
  missing, never a secret. **Brevo diagnostics** (`runBrevoDiagnostics`) for
  "accepted but never delivered".
- **Layout** (`renderEmail(subject, content, { brand, copy })`): one escaped
  HTML and text layout with a button and a secondary link. `copy: true` makes
  the redacted version for CC: every link left out, with a note saying why.
  `copyRecipients(cc, exclude)` picks who gets it.

Templates, the audit store and when to send stay in your app.

## Environment

| Variable | Used for |
| --- | --- |
| `EMAIL_PROVIDER` | `auto` (default: every configured provider, Brevo API first), `brevo-api`, `resend`, `brevo-smtp`, or `capture` (tests only). |
| `EMAIL_PROVIDER_ORDER` | `auto` only: providers to try first, comma separated. The rest follow in the default order. |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | Brevo API. Falls back to `EMAIL_BREVO_API_KEY` and `DEFAULT_FROM_EMAIL`. |
| `BREVO_DAILY_LIMIT` | Sends per UTC day before the Brevo API is skipped. Read it into `createDailyQuota`; 0 turns it off. |
| `RESEND_WEBHOOK_SECRET`, `BREVO_WEBHOOK_TOKEN` | Pass to `verifyResendWebhook` / `verifyBrevoWebhook`. |
| `RESEND_API_KEY`, `RESEND_SENDER_EMAIL`, `RESEND_SENDER_NAME` | Resend. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` (or `EMAIL_SENDER_USER`) | SMTP. Port 465 is implicit TLS; other ports must upgrade with STARTTLS while `EMAIL_USE_TLS` is on. |
| `EMAIL_BREVO_API_KEY` | Brevo diagnostics; also the Brevo API key when `BREVO_API_KEY` is empty. |
| `EMAIL_CC` | Comma-separated addresses for redacted copies of account emails. |

## Use

```ts
import { createEmailService, emailConfigFromEnv, parseEmailEnv, providerOrder } from "@sahan-sac/email-kit";
import { createResendProvider } from "@sahan-sac/email-kit/providers/resend"; // needs `resend`
// SMTP: createSmtpProvider from "@sahan-sac/email-kit/providers/brevo-smtp" (needs `nodemailer`)

const env = parseEmailEnv(process.env);
const config = emailConfigFromEnv(env);
const providers = providerOrder(config, process.env.NODE_ENV === "production").flatMap((name) =>
  name === "resend" && config.resend ? [createResendProvider(config.resend)] : []
);
const mail = createEmailService({ providers, audit: async (event) => myAuditLog.write(event) });
await mail.send({ to: "user@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi", category: "test" });
```

### Tracking webhooks (any Node server)

The functions take the raw body and headers, so they work in a Next.js route
handler, Express, Hono or NestJS alike:

```ts
import { nextStatus, parseResendEvent, verifyResendWebhook } from "@sahan-sac/email-kit/tracking";

app.post("/webhooks/resend", express.text({ type: "*/*" }), async (req, res) => {
  const headers = { get: (name: string) => req.header(name) ?? null };
  if (!verifyResendWebhook({ secret: process.env.RESEND_WEBHOOK_SECRET!, rawBody: req.body, headers })) return res.sendStatus(401);
  const event = parseResendEvent(JSON.parse(req.body));
  if (event) await deliveries.apply(event); // your store: status = nextStatus(row.status, event.status)
  res.sendStatus(200);
});
```

Brevo does not sign webhooks: create the transactional webhook with bearer
authentication and check `verifyBrevoWebhook({ token, authorization: req.header("authorization") })`.
Brevo reports mail sent through its API and its SMTP relay under the same
message id.
