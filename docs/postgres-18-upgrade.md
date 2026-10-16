# Moving to Postgres 18 (and keeping a replica)

The Neon project behind this site (`kso-sahan-neondb`) runs Postgres 17. Neon
cannot upgrade a project in place: a new major version means a new project
and moving the data into it. This runbook does that with **logical
replication**, so the new project stays in sync until the moment of cutover:
a few seconds of paused writes instead of a dump-and-restore outage.

The project is shared. Every step covers all of it:

| Database   | Schemas                          | App                     |
| ---------- | -------------------------------- | ----------------------- |
| `lakeview` | `sahan`, `valorem`               | this site, ValoremAdminPanel |
| `neondb`   | `admin-panel`, `public`          | the admin template      |

`neon_auth` (in `neondb`) belongs to Neon Auth, which nothing uses; it is not
copied. Recreate it in the new project only if you start using Neon Auth.

Before anything else, take a backup (`pnpm db:backup run`, docs/backups.md)
and note the newest one's id.

## 1. Turn on logical replication (old project)

Console: Project settings > Logical replication > Enable. This sets
`wal_level=logical` and **restarts the computes**: every app on the project
drops its connections for a few seconds. Neon does not let you switch it back
off; leaving it on is harmless.

## 2. Create the Postgres 18 project

Console: New project, Postgres version **18**, region **AWS us-east-1**
(same as now, so latency does not change). Create the databases `lakeview` and
`neondb`, owned by `neondb_owner`.

Keep the new project's **direct** (non-pooler) connection strings at hand;
replication and `pg_dump` must not go through the pooler.

## 3. Copy the table definitions (no rows)

For each database, with the PostgreSQL client tools (17 or newer; a 17 dump
loads into 18):

```
pg_dump --schema-only --no-owner --no-privileges \
  --schema=sahan --schema=valorem "<OLD lakeview direct url>" > lakeview.sql
psql "<NEW lakeview direct url>" -v ON_ERROR_STOP=1 -f lakeview.sql

pg_dump --schema-only --no-owner --no-privileges \
  --schema=admin-panel --schema=public "<OLD neondb direct url>" > neondb.sql
psql "<NEW neondb direct url>" -v ON_ERROR_STOP=1 -f neondb.sql
```

## 4. Start replication

Check first: every replicated table needs a primary key (or
`REPLICA IDENTITY FULL`) for updates and deletes to replicate.
`pnpm db:upgrade-check` lists any table without one. As of 2026-10-16 that is
only `valorem.verification_tokens` (Auth.js tokens), so on the **old**
`lakeview` database first run:

```sql
ALTER TABLE valorem.verification_tokens REPLICA IDENTITY FULL;
```

On the **old** project, per database:

```sql
-- lakeview
CREATE PUBLICATION pg18_move FOR TABLES IN SCHEMA sahan, valorem;
-- neondb
CREATE PUBLICATION pg18_move FOR TABLES IN SCHEMA "admin-panel", public;
```

On the **new** project, per database (this copies the existing rows, then
streams every later change):

```sql
CREATE SUBSCRIPTION pg18_move
  CONNECTION 'postgresql://neondb_owner:<password>@<OLD direct host>/<database>?sslmode=require'
  PUBLICATION pg18_move;
```

Follow progress on the new side with `SELECT * FROM pg_stat_subscription;` and
on the old side with:

```sql
SELECT slot_name, active,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS lag
  FROM pg_replication_slots;
```

Then compare the two sides, read-only:

```
SOURCE_URL="<OLD lakeview direct url>" TARGET_URL="<NEW lakeview direct url>" \
  SCHEMAS=sahan,valorem pnpm db:upgrade-check
SOURCE_URL="<OLD neondb direct url>" TARGET_URL="<NEW neondb direct url>" \
  SCHEMAS=admin-panel,public pnpm db:upgrade-check
```

While a subscription is attached, the old project's compute stays awake (no
scale to zero), so do not leave this stage running for weeks.

## 5. Cut over

1. Stop writes: turn on maintenance mode in each app (this site: Admin >
   Settings > Maintenance), and pause the crons.
2. Wait for the lag above to reach 0 bytes, then run `pnpm db:upgrade-check`
   once more: every table must say `ok`.
3. Sequences are not replicated. Print the fix and run it on the **new**
   database: `pnpm db:upgrade-check --sequences-sql`.
4. On the new project: `DROP SUBSCRIPTION pg18_move;` (per database). On the
   old one: `DROP PUBLICATION pg18_move;`.
5. Point every app at the new project: `DATABASE_URL` (and any direct URL) in
   Vercel for this site, ValoremAdminPanel and the template; redeploy them.
6. Turn maintenance off, clear this site's caches (Admin > Settings > Clear
   system cache), and run `pnpm db:backup run` against the new database.
7. Make the old project read-only and keep it two weeks as the way back:

   ```sql
   ALTER DATABASE lakeview SET default_transaction_read_only = on;
   ALTER DATABASE neondb SET default_transaction_read_only = on;
   ```

   Rolling back inside those two weeks is the same procedure in reverse
   (or, if nothing was written since, just restoring the old URLs).

## Afterwards

Update `NEON_PROJECT_ID`, `NEON_BRANCH_ID` and `NEON_API_KEY` (a key for the
new project) in `.env.local` and in GitHub (the e2e job), then delete the old
project once the two weeks are up.
