# @sahan-sac/email-kit

## 0.3.0

### Minor Changes

- Allow Nodemailer 8 alongside Nodemailer 10 so email-kit can be installed with Auth.js, whose optional Nodemailer peer currently supports versions 7 and 8.

## 0.2.0

### Minor Changes

- d809ef4: `resend` and `nodemailer` are optional peer dependencies now, so an app installs only the provider SDKs it sends with. The root entry no longer re-exports the Resend and SMTP providers: import `createResendProvider` from `@sahan-sac/email-kit/providers/resend` and `createSmtpProvider` from `@sahan-sac/email-kit/providers/brevo-smtp`, and add `resend` and/or `nodemailer` to the app's dependencies. The capture provider stays at the root.

### Patch Changes

- 5e7f3cb: The build shares modules between subpaths (code splitting) instead of copying them into each one. Before, a class imported from two subpaths was two different classes, so `instanceof` failed (for example `EmailGuardError` from `@sahan-sac/email-kit/guards` against an error thrown through `./layout`), and module-level state such as caches existed once per subpath.

## 0.1.0

### Minor Changes

- 96af455: First release: Resend and SMTP (Brevo) providers with ordered fallback, a capture provider for tests, header-injection and address guards, a typed env schema (`emailEnvSchema`, including `EMAIL_CC`), provider health, Brevo delivery diagnostics, and one escaped HTML/text layout whose `copy` mode makes a redacted CC version with every link left out (`copyRecipients` picks who gets it).
