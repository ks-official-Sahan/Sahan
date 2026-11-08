import assert from "node:assert/strict";
import { test } from "node:test";

import type { SmtpTransport } from "./brevo-smtp";
import { createGenericSmtpProvider, genericSmtpConfig } from "./smtp";

const base = { host: "smtp.example.com", from: "sender@example.com" };

test("generic SMTP: production uses implicit TLS on 465 by default", () => {
  const config = genericSmtpConfig({ ...base, production: true });
  assert.equal(config.port, 465);
  assert.equal(config.secure, true);
  assert.equal(config.requireTLS, false);
});

test("generic SMTP: production requires STARTTLS on any other port", () => {
  const config = genericSmtpConfig({ ...base, port: 587, production: true });
  assert.equal(config.secure, false);
  assert.equal(config.requireTLS, true);
});

test("generic SMTP: outside production a plain local catcher works without AUTH", () => {
  const config = genericSmtpConfig({ ...base, host: "127.0.0.1", production: false });
  assert.equal(config.port, 1025);
  assert.equal(config.secure, false);
  assert.equal(config.requireTLS, false);
  assert.equal(config.user, undefined);
  assert.equal(config.pass, undefined);
});

test("generic SMTP: AUTH is passed through when given", () => {
  const config = genericSmtpConfig({ ...base, production: true, auth: { user: "u", pass: "p" } });
  assert.equal(config.user, "u");
  assert.equal(config.pass, "p");
});

test("generic SMTP: an invalid sender is refused before any connection", () => {
  assert.throws(() => genericSmtpConfig({ ...base, from: "not an address\r\nBcc: x@example.com", production: false }));
});

test("generic SMTP: the provider reports its own name and delivers", async () => {
  const transport: SmtpTransport = {
    sendMail: async () => ({ messageId: "<id@example.com>", accepted: ["to@example.com"], rejected: [] }),
  };
  const provider = createGenericSmtpProvider({ ...base, production: false }, transport);
  assert.equal(provider.name, "smtp");
  const outcome = await provider.send({
    to: ["to@example.com"],
    cc: [],
    bcc: [],
    subject: "Hi",
    html: "<p>Hi</p>",
    text: "Hi",
    category: "invite",
  });
  assert.deepEqual(outcome, { ok: true, messageId: "<id@example.com>" });
});
