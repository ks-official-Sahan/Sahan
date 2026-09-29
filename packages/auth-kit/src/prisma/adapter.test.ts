import { pathToFileURL } from "node:url";

import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";

import { runAdapterContract } from "../test-support/adapter-contract";
import { generatePrismaClient, pgliteWith, prismaDdl } from "../test-support/pg";
import { createPrismaAuthAdapter } from "./index";

// Prisma talks to the in-process PGlite over a local socket (pglite-socket),
// through the same node-postgres driver adapter a real deploy can use.
runAdapterContract("Prisma", async () => {
  const entry = generatePrismaClient();
  const pg = await pgliteWith(prismaDdl());
  const server = new PGLiteSocketServer({ db: pg, port: 0 });
  await server.start();
  const { PrismaClient } = await import(pathToFileURL(entry).href);
  const connectionString = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 1 }) });
  return {
    adapter: createPrismaAuthAdapter(prisma),
    pg,
    async close() {
      await prisma.$disconnect();
      await server.stop();
      await pg.close();
    },
  };
});
