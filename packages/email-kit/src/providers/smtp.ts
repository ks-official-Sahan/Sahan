import { assertMailbox } from "../guards";

import type { SmtpConfig } from "../config";
import { createSmtpProvider, type SmtpTransport } from "./brevo-smtp";

import type { EmailProvider } from "../types";

// Any SMTP relay, not only Brevo: a local Mailpit in development, a self-hosted
// relay, or a provider's submission port. AUTH is optional. In production the
// connection must be encrypted: implicit TLS on 465, STARTTLS required on every
// other port. Outside production a plain connection is allowed, so a local
// catcher on 1025 works without certificates.

export interface GenericSmtpOptions {
  host: string;
  /** Defaults to 465 in production (implicit TLS), else 1025 (a local catcher such as Mailpit). */
  port?: number;
  from: string;
  /** Leave out for a relay that accepts mail without AUTH. */
  auth?: { user: string; pass: string };
  /** Turns on the TLS requirement. Pass `process.env.NODE_ENV === "production"`. */
  production: boolean;
}

/** The resolved connection settings. Pure, so the TLS rules are unit tested without a socket. */
export function genericSmtpConfig(options: GenericSmtpOptions): SmtpConfig {
  const port = options.port ?? (options.production ? 465 : 1025);
  const secure = options.production && port === 465;
  return {
    host: options.host,
    port,
    secure,
    requireTLS: options.production && !secure,
    ...(options.auth ? { user: options.auth.user, pass: options.auth.pass } : {}),
    from: assertMailbox(options.from, "from"),
  };
}

export function createGenericSmtpProvider(options: GenericSmtpOptions, transport?: SmtpTransport): EmailProvider {
  return createSmtpProvider(genericSmtpConfig(options), transport, "smtp");
}
