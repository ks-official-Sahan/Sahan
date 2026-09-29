import { drizzle } from "drizzle-orm/pglite";

import { runAdapterContract } from "../test-support/adapter-contract";
import { drizzleDdl, pgliteWith, testSchema } from "../test-support/pg";
import { createDrizzleAuthAdapter } from "./adapter";

runAdapterContract("Drizzle", async () => {
  const pg = await pgliteWith(await drizzleDdl());
  const adapter = createDrizzleAuthAdapter(drizzle({ client: pg }), testSchema());
  return { adapter, pg, close: () => pg.close() };
});
