// @sahan-sac/email-kit: providers with ordered fallback, guards, env schema,
// health, diagnostics and one escaped layout. Templates, audit storage and the
// choice of when to send stay in the app.

export * from "./types";
export * from "./guards";
export * from "./env";
export * from "./config";
export * from "./service";
export * from "./health";
export * from "./layout";
export * from "./sign-in-link-message";
export * from "./recipients";
export * from "./brevo-diagnostics";
export * from "./quota";
export * from "./tracking";
export * from "./providers/capture";
// Resend, Brevo API and SMTP live at their own subpaths (`./providers/resend`,
// `./providers/brevo-api`, `./providers/brevo-smtp`). Resend and SMTP need
// their SDKs (`resend`, `nodemailer`), so an app installs only the ones it
// sends with; the Brevo API provider needs nothing beyond fetch.
