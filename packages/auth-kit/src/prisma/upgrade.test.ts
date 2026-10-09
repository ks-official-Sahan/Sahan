import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { hashSessionToken } from "../better-auth/hash-tokens";
import { describeDb, pgliteWith, prismaDdl } from "../test-support/pg";

// prisma/upgrade.sql turns any older database into the current schema without
// losing a row, does nothing on a current one, and does nothing the second time.

const UPGRADE = readFileSync(new URL("../../prisma/upgrade.sql", import.meta.url), "utf8");

test("upgrade.sql: a pre-0.5, pre-0.7 database becomes the current schema, data kept, safe to rerun", async () => {
  const legacy = new PGlite();
  const current = await pgliteWith(prismaDdl());
  try {
    await legacy.exec(prismaDdl("src/test-support/legacy-enum-roles.prisma"));
    // Before 0.5 there were no Better Auth columns either.
    await legacy.exec(`
      DROP INDEX "user_sessions_token_key";
      ALTER TABLE user_sessions DROP COLUMN token, DROP COLUMN "updatedAt";
      ALTER TABLE users DROP COLUMN "emailVerified";
      INSERT INTO users (id, email, "passwordHash", role, "updatedAt") VALUES ('u1', 'dev@example.com', 'h', 'DEVELOPER', now()), ('u2', 'ed@example.com', 'h', DEFAULT, now());
      INSERT INTO role_permissions (role, permission) VALUES ('MANAGER', 'viewUsers');
      INSERT INTO auth_tokens (id, purpose, email, role, "tokenHash", "expiresAt") VALUES ('t1', 'INVITE', 'new@example.com', 'MANAGER', 'hash', now());
      INSERT INTO user_sessions (id, "userId", "expiresAt") VALUES ('s1', 'u1', now() + interval '1 day');
      INSERT INTO audit_logs (id, "actorId", action, "entityType") VALUES ('a1', 'u1', 'user.signIn', 'user'), ('a2', NULL, 'cron.run', 'cron');
    `);

    // Another schema with its own "Role" enum (a copy, an extension) must be left alone and never counted.
    const otherSchema = `CREATE SCHEMA other; CREATE TYPE other."Role" AS ENUM ('X', 'Y');`;
    await Promise.all([legacy.exec(otherSchema), current.exec(otherSchema)]);

    await legacy.exec(UPGRADE);
    await legacy.exec(UPGRADE);

    assert.deepEqual(await describeDb(legacy), await describeDb(current));
    const audit = await legacy.query<{ id: string; actorRole: string | null }>(`SELECT id, "actorRole" FROM audit_logs ORDER BY id`);
    assert.deepEqual(audit.rows, [{ id: "a1", actorRole: "DEVELOPER" }, { id: "a2", actorRole: null }], "older rows take the actor's role");
    const roles = await legacy.query<{ name: string; label: string; rank: number; system: boolean }>(
      "SELECT name, label, rank, system FROM roles ORDER BY rank"
    );
    assert.deepEqual(roles.rows, [
      { name: "DEVELOPER", label: "Developer", rank: 0, system: true },
      { name: "MANAGER", label: "Manager", rank: 10, system: true },
      { name: "EDITOR", label: "Editor", rank: 20, system: true },
    ]);
    const users = await legacy.query<{ id: string; role: string; emailVerified: boolean }>('SELECT id, role, "emailVerified" FROM users ORDER BY id');
    assert.deepEqual(users.rows, [
      { id: "u1", role: "DEVELOPER", emailVerified: false },
      { id: "u2", role: "EDITOR", emailVerified: false },
    ]);
    assert.equal((await legacy.query("SELECT 1 FROM role_permissions WHERE role = 'MANAGER'")).rows.length, 1);
    assert.equal((await legacy.query<{ role: string }>("SELECT role FROM auth_tokens")).rows[0].role, "MANAGER");
    assert.equal((await legacy.query<{ token: string | null }>("SELECT token FROM user_sessions WHERE id = 's1'")).rows[0].token, null);
    await assert.rejects(legacy.exec("INSERT INTO users (id, email, \"passwordHash\", role, \"updatedAt\") VALUES ('u3', 'x@example.com', 'h', 'GHOST', now())"));
  } finally {
    await Promise.all([legacy.close(), current.close()]);
  }
});

test("upgrade.sql: a raw session token is cleared and its session ended; hashed tokens are kept", async () => {
  const db = await pgliteWith(prismaDdl());
  try {
    const hashed = hashSessionToken("cookie-token");
    await db.exec(`
      INSERT INTO users (id, email, "passwordHash", role, "updatedAt") VALUES ('u1', 'dev@example.com', 'h', 'EDITOR', now());
      INSERT INTO user_sessions (id, "userId", token, "expiresAt") VALUES
        ('raw', 'u1', 'yZLAoaC68pceX1TH5phhOEH3jTVMc1KG', now() + interval '1 day'),
        ('hashed', 'u1', '${hashed}', now() + interval '1 day');
    `);
    await db.exec(UPGRADE);
    await db.exec(UPGRADE);
    const rows = await db.query<{ id: string; token: string | null; revoked: boolean; revokeReason: string | null }>(
      'SELECT id, token, "revokedAt" IS NOT NULL AS revoked, "revokeReason" FROM user_sessions ORDER BY id'
    );
    assert.deepEqual(rows.rows, [
      { id: "hashed", token: hashed, revoked: false, revokeReason: null },
      { id: "raw", token: null, revoked: true, revokeReason: "upgrade" },
    ]);
  } finally {
    await db.close();
  }
});
