# @sahan-sac/email-kit

Transactional email for server apps, framework-agnostic:

- **Providers with fallback**: Resend over HTTPS and any SMTP relay (Brevo by
  default) through nodemailer, tried in order; a failure about the message
  itself is not retried elsewhere. A `capture` provider keeps mail in memory
  for tests and is refused in production.
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
| `EMAIL_PROVIDER` | `auto` (default: every configured provider, Resend first), `resend`, `brevo-smtp`, or `capture` (tests only). |
| `RESEND_API_KEY`, `RESEND_SENDER_EMAIL`, `RESEND_SENDER_NAME` | Resend. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` (or `EMAIL_SENDER_USER`) | SMTP. Port 465 is implicit TLS; other ports must upgrade with STARTTLS while `EMAIL_USE_TLS` is on. |
| `EMAIL_BREVO_API_KEY` | Read-only Brevo diagnostics. |
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
