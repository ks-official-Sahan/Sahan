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
export * from "./recipients";
export * from "./brevo-diagnostics";
export * from "./providers/capture";
// Resend and SMTP live at their own subpaths (`./providers/resend`,
// `./providers/brevo-smtp`): each needs its SDK (`resend`, `nodemailer`),
// and an app installs only the ones it sends with.
