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
export * from "./providers/resend";
export * from "./providers/brevo-smtp";
export * from "./providers/capture";
