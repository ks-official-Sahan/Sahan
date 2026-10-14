import assert from "node:assert/strict";
import { test } from "node:test";

import { passkeyErrorMessage, passkeySupportFor, unsupportedReason } from "./passkey-browser";

const ready = { secure: true, webauthn: true, hostname: "example.com" };

test("a passkey is offered only on the relying party's host or a subdomain of it", () => {
  assert.equal(passkeySupportFor(ready, "example.com"), "ready");
  assert.equal(passkeySupportFor({ ...ready, hostname: "www.example.com" }, "example.com"), "ready");
  assert.equal(passkeySupportFor({ ...ready, hostname: "WWW.Example.com" }, "example.com"), "ready");
  assert.equal(passkeySupportFor({ ...ready, hostname: "sahan-git-x.vercel.app" }, "example.com"), "other-address");
  assert.equal(passkeySupportFor({ ...ready, hostname: "notexample.com" }, "example.com"), "other-address");
  assert.equal(passkeySupportFor({ ...ready, hostname: "192.168.1.20" }, "example.com"), "other-address");
});

test("an insecure page or a browser without WebAuthn is reported before the address", () => {
  assert.equal(passkeySupportFor({ ...ready, secure: false }, "example.com"), "insecure");
  assert.equal(passkeySupportFor({ ...ready, webauthn: false }, "example.com"), "unsupported");
  assert.equal(unsupportedReason("ready", "example.com"), null);
  assert.match(unsupportedReason("other-address", "example.com") ?? "", /only work at example\.com/);
});

test("WebAuthnError codes and DOMException names map to specific messages", () => {
  assert.match(passkeyErrorMessage({ code: "ERROR_INVALID_RP_ID", name: "SecurityError" }, "example.com", "sign-in"), /only work at example\.com/);
  assert.match(passkeyErrorMessage({ code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED", name: "InvalidStateError" }, "example.com", "add"), /already has a passkey/);
  assert.match(passkeyErrorMessage({ name: "NotAllowedError" }, "example.com", "sign-in"), /no passkey for your account/);
  assert.match(passkeyErrorMessage({ name: "NotAllowedError" }, "example.com", "add"), /No passkey was saved/);
  assert.match(passkeyErrorMessage({ code: "ERROR_CEREMONY_ABORTED", name: "AbortError" }, "example.com", "sign-in"), /cancelled/);
});

test("anything unknown gets a generic message, never a throw", () => {
  assert.match(passkeyErrorMessage(null, "example.com", "sign-in"), /could not be used/);
  assert.match(passkeyErrorMessage(new Error("boom"), "example.com", "add"), /could not be added/);
});
