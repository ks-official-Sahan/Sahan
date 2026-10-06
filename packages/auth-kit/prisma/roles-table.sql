-- auth-kit 0.7: the Postgres enum "Role" becomes the "roles" table, so an
-- admin can add roles without a deploy. Run once, before deploying code that
-- uses auth-kit 0.7 (then `prisma db push` / `drizzle-kit push` has nothing to
-- do). Safe to run again: it does nothing once the enum is gone.
--
-- Every enum value becomes a system role, ranked in enum order (0, 10, 20,
-- ...), so the first value must be your super role. Labels are the names in
-- title case; change labels and ranks afterwards in the admin.

DO $$
BEGIN
  -- Only this schema's enum: another schema (a copy, an extension) may have its own.
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'Role' AND n.nspname = current_schema()
  ) THEN
    RAISE NOTICE 'roles-table: no "Role" enum, nothing to do';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS "roles" (
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "rank" INTEGER NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("name")
  );
  CREATE INDEX IF NOT EXISTS "roles_rank_idx" ON "roles"("rank");

  INSERT INTO "roles" ("name", "label", "rank", "system", "updatedAt")
  SELECT e.enumlabel, initcap(replace(lower(e.enumlabel), '_', ' ')), (row_number() OVER (ORDER BY e.enumsortorder) - 1)::int * 10, true, CURRENT_TIMESTAMP
  FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE t.typname = 'Role' AND n.nspname = current_schema()
  ON CONFLICT ("name") DO NOTHING;

  ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
  ALTER TABLE "users" ALTER COLUMN "role" TYPE TEXT USING "role"::text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'EDITOR';
  ALTER TABLE "role_permissions" ALTER COLUMN "role" TYPE TEXT USING "role"::text;
  ALTER TABLE "auth_tokens" ALTER COLUMN "role" TYPE TEXT USING "role"::text;
  EXECUTE format('DROP TYPE %I.%I', current_schema(), 'Role');

  CREATE INDEX "users_role_idx" ON "users"("role");
  ALTER TABLE "users" ADD CONSTRAINT "users_role_fkey"
    FOREIGN KEY ("role") REFERENCES "roles"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_fkey"
    FOREIGN KEY ("role") REFERENCES "roles"("name") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_role_fkey"
    FOREIGN KEY ("role") REFERENCES "roles"("name") ON DELETE SET NULL ON UPDATE CASCADE;
END $$;
