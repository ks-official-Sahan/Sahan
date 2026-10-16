// Read-only comparison of two databases during the Postgres 18 move
// (docs/postgres-18-upgrade.md). Never writes to either side.
//
//   SOURCE_URL=<pg17 direct url> TARGET_URL=<pg18 direct url> SCHEMAS=sahan,valorem pnpm db:upgrade-check
//   ... pnpm db:upgrade-check --sequences-sql    also print setval() SQL for the cutover
//
// Reports server versions, tables without a primary key (logical replication
// cannot apply UPDATE/DELETE to them without REPLICA IDENTITY FULL), row
// counts per table on both sides, and sequence values. Logical replication
// copies rows but not sequence positions, so --sequences-sql prints the
// setval() statements to run on the target at cutover.
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const SCHEMA = /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/;
const quote = (name: string) => {
  if (!SCHEMA.test(name)) throw new Error(`Refusing unusual identifier "${name}"`);
  return `"${name}"`;
};

async function readSide(url: string, schemas: string[]) {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const client = await pool.connect();
    try {
      await client.query("SET default_transaction_read_only = on");
      const version = (await client.query<{ server_version: string }>("SHOW server_version")).rows[0].server_version;
      const tables = (
        await client.query<{ schema: string; table: string; has_pk: boolean }>(
          `SELECT n.nspname AS schema, c.relname AS table,
                  EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'p') AS has_pk
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind IN ('r', 'p') AND n.nspname = ANY($1::text[])
            ORDER BY 1, 2`,
          [schemas]
        )
      ).rows;
      const counts = new Map<string, number>();
      for (const { schema, table } of tables) {
        const { rows } = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${quote(schema)}.${quote(table)}`);
        counts.set(`${schema}.${table}`, rows[0].n);
      }
      const sequences = (
        await client.query<{ schema: string; name: string; last_value: string | null }>(
          `SELECT schemaname AS schema, sequencename AS name, last_value::text FROM pg_sequences WHERE schemaname = ANY($1::text[]) ORDER BY 1, 2`,
          [schemas]
        )
      ).rows;
      return { version, tables, counts, sequences };
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const source = process.env.SOURCE_URL;
  const target = process.env.TARGET_URL;
  const schemas = (process.env.SCHEMAS ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  if (!source || !target || schemas.length === 0) throw new Error("Set SOURCE_URL, TARGET_URL and SCHEMAS (comma-separated)");
  for (const schema of schemas) quote(schema);

  const [from, to] = await Promise.all([readSide(source, schemas), readSide(target, schemas)]);
  console.log(`source Postgres ${from.version}, target Postgres ${to.version}`);

  const noPk = from.tables.filter((table) => !table.has_pk).map((table) => `${table.schema}.${table.table}`);
  if (noPk.length > 0) console.log(`tables without a primary key (need REPLICA IDENTITY FULL before replicating): ${noPk.join(", ")}`);

  let mismatches = 0;
  for (const [name, count] of from.counts) {
    const other = to.counts.get(name);
    const ok = other === count;
    if (!ok) mismatches += 1;
    console.log(`${name.padEnd(48)} source ${String(count).padStart(8)}  target ${String(other ?? "missing").padStart(8)}  ${ok ? "ok" : "DIFFERS"}`);
  }
  for (const name of to.counts.keys()) if (!from.counts.has(name)) console.log(`${name.padEnd(48)} only on the target`);
  console.log(mismatches === 0 ? "row counts match" : `${mismatches} table(s) differ`);

  const targetSequences = new Map(to.sequences.map((sequence) => [`${sequence.schema}.${sequence.name}`, sequence.last_value]));
  for (const sequence of from.sequences) {
    const name = `${sequence.schema}.${sequence.name}`;
    console.log(`sequence ${name}: source ${sequence.last_value ?? "unused"}, target ${targetSequences.get(name) ?? "missing"}`);
  }
  if (process.argv.includes("--sequences-sql")) {
    console.log("\n-- Run on the TARGET at cutover, after writes have stopped and replication has caught up:");
    for (const sequence of from.sequences) {
      if (sequence.last_value === null) continue;
      console.log(`SELECT setval('${quote(sequence.schema)}.${quote(sequence.name)}', ${BigInt(sequence.last_value)}, true);`);
    }
  }
  if (mismatches > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
