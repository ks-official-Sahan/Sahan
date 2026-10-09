import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// auth-kit's tables for Drizzle (Postgres). Table, column, enum, index and
// constraint names match prisma/auth.prisma exactly, so one database works
// with either ORM and a project can switch without a migration. The package
// tests create both schemas and compare them column by column.

const now = sql`CURRENT_TIMESTAMP`;
const newId = () => crypto.randomUUID();
const at = (name: string) => timestamp(name, { precision: 3, mode: "date" });

export interface AuthSchemaOptions<TRole extends string> {
  /**
   * Your built-in role names. Roles live in the `roles` table (seed these
   * rows); this list only types the role columns.
   */
  roles?: readonly [TRole, ...TRole[]];
  /** Role a new user gets when none is given. Must exist in `roles`. */
  defaultRole: NoInfer<TRole>;
}

export function createAuthSchema<TRole extends string = string>(options: AuthSchemaOptions<TRole>) {
  // Roles are rows, so an admin adds one without a deploy. `rank` is the
  // hierarchy: a lower rank manages higher ranks. System roles cannot be
  // renamed or deleted.
  const roles = pgTable(
    "roles",
    {
      name: text("name").primaryKey().$type<TRole>(),
      label: text("label").notNull(),
      description: text("description"),
      rank: integer("rank").notNull(),
      system: boolean("system").notNull().default(false),
      createdAt: at("createdAt").notNull().default(now),
      updatedAt: at("updatedAt")
        .notNull()
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date()),
    },
    (t) => [index("roles_rank_idx").on(t.rank)]
  );
  const mfaPurposeEnum = pgEnum("MfaPurpose", ["SIGN_IN", "ENABLE", "DISABLE", "STEP_UP"]);
  const tokenPurposeEnum = pgEnum("TokenPurpose", ["INVITE", "PASSWORD_RESET", "EMAIL_CHANGE"]);

  const users = pgTable(
    "users",
    {
      id: text("id").primaryKey().$defaultFn(newId),
      // Stored lowercase; normalise before every write.
      email: text("email").notNull(),
      // Read by the Better Auth engine; the app's own flows never set it.
      emailVerified: boolean("emailVerified").notNull().default(false),
      name: text("name"),
      passwordHash: text("passwordHash").notNull(),
      role: text("role").$type<TRole>().notNull().default(options.defaultRole),
      image: text("image"),
      bio: text("bio"),
      mfaEnabled: boolean("mfaEnabled").notNull().default(false),
      mustChangePassword: boolean("mustChangePassword").notNull().default(false),
      // Shown to non-super-role viewers as another role (see ../rbac/mask). Presentation only.
      masked: boolean("masked").notNull().default(false),
      passwordChangedAt: at("passwordChangedAt").notNull().default(now),
      lastLoginAt: at("lastLoginAt"),
      disabledAt: at("disabledAt"),
      createdById: text("createdById"),
      createdAt: at("createdAt").notNull().default(now),
      updatedAt: at("updatedAt")
        .notNull()
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date()),
    },
    (t) => [
      uniqueIndex("users_email_key").on(t.email),
      index("users_role_idx").on(t.role),
      foreignKey({ name: "users_role_fkey", columns: [t.role], foreignColumns: [roles.name] })
        .onDelete("restrict")
        .onUpdate("cascade"),
    ]
  );

  // A row means the permission is granted to the role. The super role holds
  // every permission in code, so it needs no rows.
  const rolePermissions = pgTable(
    "role_permissions",
    {
      role: text("role").$type<TRole>().notNull(),
      permission: text("permission").notNull(),
      updatedById: text("updatedById"),
      updatedAt: at("updatedAt")
        .notNull()
        .default(now)
        .$onUpdate(() => new Date()),
    },
    (t) => [
      primaryKey({ name: "role_permissions_pkey", columns: [t.role, t.permission] }),
      foreignKey({ name: "role_permissions_role_fkey", columns: [t.role], foreignColumns: [roles.name] })
        .onDelete("cascade")
        .onUpdate("cascade"),
    ]
  );

  // One row per signed-in browser. `id` is the `sid` claim in the JWT
  // (next-auth engine); `token` is the session cookie value (Better Auth engine).
  const userSessions = pgTable(
    "user_sessions",
    {
      id: text("id").primaryKey().$defaultFn(newId),
      token: text("token"),
      userId: text("userId").notNull(),
      ip: text("ip"),
      userAgent: text("userAgent"),
      browser: text("browser"),
      os: text("os"),
      device: text("device"),
      mfaVerified: boolean("mfaVerified").notNull().default(false),
      createdAt: at("createdAt").notNull().default(now),
      updatedAt: at("updatedAt")
        .notNull()
        .default(now)
        .$onUpdate(() => new Date()),
      lastSeenAt: at("lastSeenAt").notNull().default(now),
      expiresAt: at("expiresAt").notNull(),
      revokedAt: at("revokedAt"),
      revokedById: text("revokedById"),
      revokeReason: text("revokeReason"),
    },
    (t) => [
      foreignKey({ name: "user_sessions_userId_fkey", columns: [t.userId], foreignColumns: [users.id] })
        .onDelete("cascade")
        .onUpdate("cascade"),
      uniqueIndex("user_sessions_token_key").on(t.token),
      index("user_sessions_userId_revokedAt_idx").on(t.userId, t.revokedAt),
      index("user_sessions_expiresAt_idx").on(t.expiresAt),
      index("user_sessions_lastSeenAt_idx").on(t.lastSeenAt),
    ]
  );

  // Invite and password-reset links. Only the SHA-256 of the token is stored.
  const authTokens = pgTable(
    "auth_tokens",
    {
      id: text("id").primaryKey().$defaultFn(newId),
      purpose: tokenPurposeEnum("purpose").notNull(),
      email: text("email").notNull(),
      userId: text("userId"),
      // Role granted on acceptance (invites only).
      role: text("role").$type<TRole>(),
      tokenHash: text("tokenHash").notNull(),
      createdById: text("createdById"),
      expiresAt: at("expiresAt").notNull(),
      usedAt: at("usedAt"),
      revokedAt: at("revokedAt"),
      createdAt: at("createdAt").notNull().default(now),
    },
    (t) => [
      uniqueIndex("auth_tokens_tokenHash_key").on(t.tokenHash),
      foreignKey({ name: "auth_tokens_role_fkey", columns: [t.role], foreignColumns: [roles.name] })
        .onDelete("set null")
        .onUpdate("cascade"),
      index("auth_tokens_email_purpose_idx").on(t.email, t.purpose),
      index("auth_tokens_expiresAt_idx").on(t.expiresAt),
      index("auth_tokens_purpose_expiresAt_idx").on(t.purpose, t.expiresAt),
    ]
  );

  // Emailed one-time codes for sign-in, enabling and disabling MFA.
  const mfaChallenges = pgTable(
    "mfa_challenges",
    {
      id: text("id").primaryKey().$defaultFn(newId),
      userId: text("userId").notNull(),
      purpose: mfaPurposeEnum("purpose").notNull(),
      codeHash: text("codeHash").notNull(),
      attempts: integer("attempts").notNull().default(0),
      expiresAt: at("expiresAt").notNull(),
      verifiedAt: at("verifiedAt"),
      consumedAt: at("consumedAt"),
      createdAt: at("createdAt").notNull().default(now),
    },
    (t) => [
      foreignKey({ name: "mfa_challenges_userId_fkey", columns: [t.userId], foreignColumns: [users.id] })
        .onDelete("cascade")
        .onUpdate("cascade"),
      index("mfa_challenges_userId_purpose_expiresAt_idx").on(t.userId, t.purpose, t.expiresAt),
      index("mfa_challenges_expiresAt_idx").on(t.expiresAt),
    ]
  );

  const auditLogs = pgTable(
    "audit_logs",
    {
      id: text("id").primaryKey().$defaultFn(newId),
      actorId: text("actorId"),
      // Snapshots, so the trail survives deleting the user or changing their role.
      actorEmail: text("actorEmail"),
      actorRole: text("actorRole"),
      action: text("action").notNull(),
      entityType: text("entityType").notNull(),
      entityId: text("entityId"),
      before: jsonb("before"),
      after: jsonb("after"),
      ip: text("ip"),
      userAgent: text("userAgent"),
      meta: jsonb("meta"),
      createdAt: at("createdAt").notNull().default(now),
    },
    (t) => [
      foreignKey({ name: "audit_logs_actorId_fkey", columns: [t.actorId], foreignColumns: [users.id] })
        .onDelete("set null")
        .onUpdate("cascade"),
      index("audit_logs_createdAt_id_idx").on(t.createdAt, t.id),
      index("audit_logs_actorId_idx").on(t.actorId),
      index("audit_logs_action_idx").on(t.action),
      index("audit_logs_entityType_entityId_idx").on(t.entityType, t.entityId),
    ]
  );

  return { roles, mfaPurposeEnum, tokenPurposeEnum, users, rolePermissions, userSessions, authTokens, mfaChallenges, auditLogs };
}

export type AuthSchema<TRole extends string = string> = ReturnType<typeof createAuthSchema<TRole>>;
