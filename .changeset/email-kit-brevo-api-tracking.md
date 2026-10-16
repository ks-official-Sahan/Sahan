---
"@sahan-sac/email-kit": minor
---

Brevo transactional API provider (`./providers/brevo-api`, plain fetch), now first in `auto` mode: Brevo API, then Resend, then Brevo SMTP. `EMAIL_PROVIDER_ORDER` and a `preferred` argument to `providerOrder()` move providers to the front. A per-provider daily quota (`./quota`, Brevo default 300) skips a provider at its limit. Delivery tracking (`./tracking`): Svix-verified Resend webhooks, bearer-checked Brevo webhooks, normalized events and a forward-only `nextStatus()`. `createEmailService` takes optional `quota` and `track` dependencies; messages take an optional `ref`, sent as a provider tag.
