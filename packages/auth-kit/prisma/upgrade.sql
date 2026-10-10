-- Brings a database from any earlier auth-kit version to the current schema.
-- Run it before deploying a new auth-kit version; afterwards `prisma db push`
-- / `drizzle-kit push` has nothing to do. Every step checks before it acts,
-- so it is safe to run on a current database and to run again. It only works
-- on the current schema (search_path), never on another schema's objects.
--
--   Prisma:       prisma db execute --file node_modules/@sahan-sac/auth-kit/prisma/upgrade.sql
--   Drizzle/SQL:  psql "$DATABASE_URL" -f node_modules/@sahan-sac/auth-kit/prisma/upgrade.sql
--   Any app:      npx auth-kit db upgrade --apply

-- 1. auth-kit 0.5: the columns both engines share (Better Auth reads them;
--    next-auth leaves them at their defaults).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "token" TEXT;
ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_token_key" ON "user_sessions"("token");

-- 2. auth-kit 0.7: user_sessions.token holds the SHA-256 of the session cookie
--    token (43 base64url characters), never the token itself. A row still
--    holding a raw token can no longer be matched by any cookie: clear the
--    token and end the session, so its owner signs in once more.
UPDATE "user_sessions"
SET "token" = NULL,
    "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP),
    "revokeReason" = COALESCE("revokeReason", 'upgrade')
WHERE "token" IS NOT NULL AND "token" !~ '^[A-Za-z0-9_-]{43}$';

-- 3. auth-kit 0.7: the Postgres enum "Role" becomes the "roles" table, so an
--    admin can add roles without a deploy. Every enum value becomes a system
--    role, ranked in enum order (0, 10, 20, ...), so the first value must be
--    your super role. Labels are the names in title case; change labels and
--    ranks afterwards in the admin.
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

-- 4. auth-kit 0.7: masking and the audit actor's role. users.masked shows a
--    super-role account as another role (presentation only); audit rows keep
--    the actor's role at the time. Older rows take the actor's current role.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "masked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "actorRole" TEXT;
UPDATE "audit_logs" a SET "actorRole" = u."role"
FROM "users" u
WHERE a."actorId" = u."id" AND a."actorRole" IS NULL;

-- 5. auth-kit 0.8: step-up codes. An emailed code with purpose STEP_UP
--    confirms one sensitive action (./mfa signStepUp). Needs Postgres 12+.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'MfaPurpose' AND n.nspname = current_schema()
  ) THEN
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', current_schema(), 'MfaPurpose', 'STEP_UP');
  END IF;
END $$;

-- 6. auth-kit 0.11: authenticator apps (TOTP), recovery codes and passkeys.
--    Additive only: existing users keep emailed codes until they enroll.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpSecretCipher" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpEnabledAt" TIMESTAMP(3);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'MfaPurpose' AND n.nspname = current_schema()
  ) THEN
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', current_schema(), 'MfaPurpose', 'PASSKEY_REGISTER');
    EXECUTE format('ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L', current_schema(), 'MfaPurpose', 'PASSKEY_SIGN_IN');
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS "mfa_recovery_codes" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mfa_recovery_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "mfa_recovery_codes_userId_codeHash_key" ON "mfa_recovery_codes"("userId", "codeHash");
CREATE TABLE IF NOT EXISTS "webauthn_credentials" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "publicKey" TEXT NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "deviceType" TEXT NOT NULL,
  "backedUp" BOOLEAN NOT NULL DEFAULT false,
  "name" TEXT NOT NULL DEFAULT 'Passkey',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "webauthn_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "webauthn_credentials_userId_idx" ON "webauthn_credentials"("userId");
