---
"@sahan-sac/email-kit": minor
---

`resend` and `nodemailer` are optional peer dependencies now, so an app installs only the provider SDKs it sends with. The root entry no longer re-exports the Resend and SMTP providers: import `createResendProvider` from `@sahan-sac/email-kit/providers/resend` and `createSmtpProvider` from `@sahan-sac/email-kit/providers/brevo-smtp`, and add `resend` and/or `nodemailer` to the app's dependencies. The capture provider stays at the root.
