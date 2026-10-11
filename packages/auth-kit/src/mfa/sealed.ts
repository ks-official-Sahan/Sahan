import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// Seals a factor secret (the TOTP secret) with AES-256-GCM. The server has to
// read it back to check codes, so it is encrypted rather than hashed. The
// key comes from the caller's secret through HKDF with a purpose label; this
// module never reads env. Changing that secret makes sealed values
// unreadable, so those users set their authenticator app up again.

const INFO = "auth-kit/factor-secret/v1";

function key(master: string): Buffer {
  return Buffer.from(hkdfSync("sha256", master, "", INFO, 32));
}

export function sealFactorSecret(value: string, master: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(master), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** Throws when the value was sealed with another key or was altered. */
export function openFactorSecret(sealed: string, master: string): string {
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("Unknown sealed secret format.");
  const decipher = createDecipheriv("aes-256-gcm", key(master), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}
