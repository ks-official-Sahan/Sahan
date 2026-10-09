import assert from "node:assert/strict";
import { test } from "node:test";

import { describeDb, drizzleDdl, pgliteWith, prismaDdl } from "../test-support/pg";

// prisma/auth.prisma and the Drizzle schema must build the same database:
// same tables, columns, types, defaults, enums, indexes and constraints.

test("the Prisma and Drizzle schemas create identical databases", async () => {
  const [fromPrisma, fromDrizzle] = await Promise.all([pgliteWith(prismaDdl()), pgliteWith(await drizzleDdl())]);
  try {
    const [a, b] = await Promise.all([describeDb(fromPrisma), describeDb(fromDrizzle)]);
    assert.ok(a.columns.length > 50, "the Prisma schema created the tables");
    assert.deepEqual(b.enums, a.enums);
    assert.deepEqual(b.columns, a.columns);
    assert.deepEqual(b.indexes, a.indexes);
    assert.deepEqual(b.constraints, a.constraints);
  } finally {
    await Promise.all([fromPrisma.close(), fromDrizzle.close()]);
  }
});
