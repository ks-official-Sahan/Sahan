import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { describeDb, pgliteWith, prismaDdl } from "../test-support/pg";

// prisma/roles-table.sql turns a pre-0.7 database (the "Role" enum) into the
// current schema without losing a row, and does nothing the second time.

const MIGRATION = readFileSync(new URL("../../prisma/roles-table.sql", import.meta.url), "utf8");

test("roles-table.sql: the old enum schema becomes the current one, data kept, safe to rerun", async () => {
  const legacy = new PGlite();
  const current = await pgliteWith(prismaDdl());
  try {
    await legacy.exec(prismaDdl("src/test-support/legacy-enum-roles.prisma"));
    await legacy.exec(`
      INSERT INTO users (id, email, "passwordHash", role, "updatedAt") VALUES ('u1', 'dev@example.com', 'h', 'DEVELOPER', now()), ('u2', 'ed@example.com', 'h', DEFAULT, now());
      INSERT INTO role_permissions (role, permission) VALUES ('MANAGER', 'viewUsers');
      INSERT INTO auth_tokens (id, purpose, email, role, "tokenHash", "expiresAt") VALUES ('t1', 'INVITE', 'new@example.com', 'MANAGER', 'hash', now());
    `);

    await legacy.exec(MIGRATION);
    await legacy.exec(MIGRATION);

    assert.deepEqual(await describeDb(legacy), await describeDb(current));
    const roles = await legacy.query<{ name: string; label: string; rank: number; system: boolean }>(
      "SELECT name, label, rank, system FROM roles ORDER BY rank"
    );
    assert.deepEqual(roles.rows, [
      { name: "DEVELOPER", label: "Developer", rank: 0, system: true },
      { name: "MANAGER", label: "Manager", rank: 10, system: true },
      { name: "EDITOR", label: "Editor", rank: 20, system: true },
    ]);
    const users = await legacy.query<{ id: string; role: string }>("SELECT id, role FROM users ORDER BY id");
    assert.deepEqual(users.rows, [
      { id: "u1", role: "DEVELOPER" },
      { id: "u2", role: "EDITOR" },
    ]);
    assert.equal((await legacy.query("SELECT 1 FROM role_permissions WHERE role = 'MANAGER'")).rows.length, 1);
    assert.equal((await legacy.query<{ role: string }>("SELECT role FROM auth_tokens")).rows[0].role, "MANAGER");
    await assert.rejects(legacy.exec("INSERT INTO users (id, email, \"passwordHash\", role, \"updatedAt\") VALUES ('u3', 'x@example.com', 'h', 'GHOST', now())"));
  } finally {
    await Promise.all([legacy.close(), current.close()]);
  }
});
