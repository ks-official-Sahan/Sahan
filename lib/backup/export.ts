import { createHash } from "node:crypto";
import { createGzip } from "node:zlib";

import type { BackupConfig } from "./config";
import { FORMAT, FORMAT_VERSION, type Manifest, type ManifestTable, newBackupId, seal, tableObjectName } from "./format";
import { type BackupDb, qualified, type Query, readSchema } from "./sql";

// Reads every table of the schema inside ONE read-only REPEATABLE READ
// transaction, so the backup is a consistent snapshot: a change that touches
// two tables is in both or in neither. Rows come out through a server-side
// cursor in batches (never a whole table in one result) as row_to_json()
// text, so Postgres itself does the type conversion, and
// json_populate_recordset() reverses it exactly on restore (restore.ts).

/** Rows per FETCH: one round trip each. */
const FETCH_ROWS = 1000;
/**
 * Uncompressed bytes one table may hold. Each table is compressed in memory
 * before upload; past this the backup stops with a clear error instead of
 * running the function out of memory. Lift it with multipart uploads when a
 * table actually gets that big.
 */
export const MAX_TABLE_BYTES = 256 * 1024 * 1024;

export interface ExportDeps {
  /** Stores one object in backup `backupId`'s folder. */
  put(backupId: string, objectName: string, body: Buffer, contentType: string): Promise<void>;
  now?: () => Date;
  /** Snapshot transaction limit. */
  timeoutMs?: number;
}

async function dumpTable(query: Query, schema: string, table: string): Promise<{ gz: Buffer; rows: number }> {
  const gzip = createGzip({ level: 6 });
  const chunks: Buffer[] = [];
  gzip.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<void>((resolve, reject) => {
    gzip.on("end", resolve);
    gzip.on("error", reject);
  });

  let rows = 0;
  let bytes = 0;
  await query(`DECLARE backup_rows NO SCROLL CURSOR FOR SELECT row_to_json(t)::text AS j FROM ${qualified(schema, table)} t`);
  try {
    for (;;) {
      const batch = await query<{ j: string }>(`FETCH ${FETCH_ROWS} FROM backup_rows`);
      if (batch.length === 0) break;
      const text = batch.map((row) => row.j).join("\n") + "\n";
      bytes += Buffer.byteLength(text);
      if (bytes > MAX_TABLE_BYTES) throw new Error(`${table} is larger than ${MAX_TABLE_BYTES} bytes; backups need multipart uploads first`);
      rows += batch.length;
      if (!gzip.write(text)) await new Promise((resolve) => gzip.once("drain", resolve));
    }
  } finally {
    await query("CLOSE backup_rows");
  }
  gzip.end();
  await finished;
  return { gz: Buffer.concat(chunks), rows };
}

/**
 * Writes every table of `config.schema` and returns the backup's manifest,
 * which the caller stores LAST: only the manifest's presence makes a backup
 * complete. Tables are uploaded as they are read, inside the snapshot.
 */
export async function exportBackup(db: BackupDb, config: BackupConfig, deps: ExportDeps): Promise<Manifest> {
  const now = deps.now ?? (() => new Date());
  const createdAt = now();
  const id = newBackupId(createdAt);
  const excluded = new Set(config.excludeTables);

  const { tables, postgres } = await db.transaction(
    async (query) => {
      const [{ server_version }] = await query<{ server_version: string }>("SHOW server_version");
      const schema = await readSchema(query, config.schema);
      if (schema.tables.size === 0) throw new Error(`Schema "${config.schema}" has no tables; refusing to write an empty backup`);
      const written: ManifestTable[] = [];
      for (const [name, columns] of [...schema.tables].sort(([a], [b]) => (a < b ? -1 : 1))) {
        if (excluded.has(name)) continue;
        const { gz, rows } = await dumpTable(query, config.schema, name);
        const sealed = seal(gz, config.key, id, name);
        await deps.put(id, tableObjectName(name), sealed, "application/octet-stream");
        written.push({
          name,
          object: tableObjectName(name),
          rows,
          bytes: sealed.length,
          sha256: createHash("sha256").update(gz).digest("hex"),
          columns: columns.map((column) => [column.name, column.type]),
        });
      }
      return { tables: written, postgres: server_version };
    },
    { snapshot: true, timeoutMs: deps.timeoutMs ?? 50_000 }
  );

  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    id,
    createdAt: createdAt.toISOString(),
    finishedAt: now().toISOString(),
    schema: config.schema,
    postgres,
    keyId: config.key.id,
    tables,
    excluded: [...excluded].sort(),
  };
}
