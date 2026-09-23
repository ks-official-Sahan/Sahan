// Permission catalogue. The keys, labels and seed defaults live in code; the
// role by permission matrix lives in Postgres (RolePermission) and is edited in
// /admin/roles by DEVELOPER only. Design record: docs/plan/admin-cms-adr.md,
// section 9. No server-only import: nav and seeds read this file.

import type { RoleName } from "../adapter";

export type { RoleName };

export const ROLES = ["DEVELOPER", "MANAGER", "EDITOR"] as const satisfies readonly RoleName[];

export const PERMISSIONS = [
  // Dashboard
  "viewDashboard",
  // Pages
  "editPages",
  "publishPages",
  // Works collections
  "editCollections",
  "publishCollections",
  // Blog
  "viewBlog",
  "editBlog",
  "publishBlog",
  "deleteBlog",
  "generateAI",
  // Media
  "viewMedia",
  "uploadMedia",
  "deleteMedia",
  // Leads
  "viewLeads",
  "manageLeads",
  "exportData",
  // Chatbot
  "viewChatHistory",
  "manageChatbot",
  // Users
  "viewUsers",
  "inviteUser",
  "manageUsers",
  "deleteUser",
  "resetPassword",
  // Security
  "viewSessions",
  "revokeSessions",
  "forceLogout",
  "viewAuditLogs",
  "viewSecurityStatus",
  // Operations
  "manageSettings",
  "manageIpAllowlist",
  "clearSystemCache",
  "manageCron",
  // Access
  "managePermissions",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type PermissionGroup =
  | "Dashboard"
  | "Pages"
  | "Works"
  | "Blog"
  | "Media"
  | "Leads"
  | "Chatbot"
  | "Users"
  | "Security"
  | "Operations"
  | "Access";

export interface PermissionInfo {
  group: PermissionGroup;
  label: string;
  description: string;
}

export const PERMISSION_INFO: Record<Permission, PermissionInfo> = {
  viewDashboard: { group: "Dashboard", label: "View dashboard", description: "Open the admin dashboard." },
  editPages: { group: "Pages", label: "Edit pages", description: "Save drafts of page sections." },
  publishPages: { group: "Pages", label: "Publish pages", description: "Publish and restore page sections." },
  editCollections: { group: "Works", label: "Edit works data", description: "Create and edit projects, experience, services and skills. Saved unpublished." },
  publishCollections: { group: "Works", label: "Publish works data", description: "Publish, feature and reorder works items." },
  viewBlog: { group: "Blog", label: "View posts", description: "See the list of posts." },
  editBlog: { group: "Blog", label: "Edit posts", description: "Create and edit post drafts." },
  publishBlog: { group: "Blog", label: "Publish posts", description: "Publish, schedule and unpublish posts." },
  deleteBlog: { group: "Blog", label: "Delete posts", description: "Delete or archive posts." },
  generateAI: { group: "Blog", label: "Use AI helpers", description: "Draft text and cover images with the AI helpers." },
  viewMedia: { group: "Media", label: "View media", description: "See the media library and use the picker." },
  uploadMedia: { group: "Media", label: "Upload media", description: "Upload files and edit alt text and tags." },
  deleteMedia: { group: "Media", label: "Delete media", description: "Delete media assets." },
  viewLeads: { group: "Leads", label: "View leads", description: "See contact inquiries." },
  manageLeads: { group: "Leads", label: "Manage leads", description: "Change status, add notes and assign leads." },
  exportData: { group: "Leads", label: "Export data", description: "Download CSV exports of leads, audit log and sessions." },
  viewChatHistory: { group: "Chatbot", label: "View chat history", description: "Read chatbot conversations." },
  manageChatbot: { group: "Chatbot", label: "Manage chatbot", description: "Edit training entries, switch the bot on or off, set tone and greeting." },
  viewUsers: { group: "Users", label: "View users", description: "See the user list." },
  inviteUser: { group: "Users", label: "Invite users", description: "Send invitations." },
  manageUsers: { group: "Users", label: "Manage users", description: "Change roles, disable and enable users." },
  deleteUser: { group: "Users", label: "Delete users", description: "Delete user accounts." },
  resetPassword: { group: "Users", label: "Reset passwords", description: "Send a password reset link to a user." },
  viewSessions: { group: "Security", label: "View sessions", description: "See signed-in sessions." },
  revokeSessions: { group: "Security", label: "Revoke sessions", description: "Sign out one session." },
  forceLogout: { group: "Security", label: "Force logout", description: "Sign out every session of a user, or of everyone (DEVELOPER only)." },
  viewAuditLogs: { group: "Security", label: "View audit log", description: "Open the audit log." },
  viewSecurityStatus: { group: "Security", label: "View security status", description: "See integration health and security widgets." },
  manageSettings: { group: "Operations", label: "Manage settings", description: "Change settings, site identity, contact details, SEO defaults and maintenance mode." },
  manageIpAllowlist: { group: "Operations", label: "Manage IP allowlist", description: "Edit the admin IP allowlist." },
  clearSystemCache: { group: "Operations", label: "Clear cache", description: "Clear the site cache." },
  manageCron: { group: "Operations", label: "Run cron jobs", description: "Run scheduled jobs from the admin." },
  managePermissions: { group: "Access", label: "Manage permissions", description: "Edit the role permission matrix. Never grantable to any other role." },
};

/** Permissions no role except DEVELOPER can ever hold. */
export const NEVER_GRANTABLE: readonly Permission[] = ["managePermissions"];

const MANAGER_DENIED: ReadonlySet<Permission> = new Set<Permission>([
  "deleteUser",
  "manageSettings",
  "manageIpAllowlist",
  "clearSystemCache",
  "managePermissions",
]);

/** Seed defaults for the editable roles. DEVELOPER always holds everything. */
export const DEFAULT_GRANTS: Record<"MANAGER" | "EDITOR", readonly Permission[]> = {
  MANAGER: PERMISSIONS.filter((permission) => !MANAGER_DENIED.has(permission)),
  EDITOR: [
    "viewDashboard",
    "editPages",
    "editCollections",
    "viewBlog",
    "editBlog",
    "generateAI",
    "viewMedia",
    "uploadMedia",
  ],
};

/** Bump when a release adds permissions, and record them in PERMISSION_ADDED_IN. */
export const RBAC_SEED_VERSION = 1;

/**
 * Seed version in which a permission first existed. Permissions missing from
 * this map have existed since version 1. The seed grants a new permission to the
 * roles whose defaults include it, once, and never re-grants a permission the
 * owner removed.
 */
export const PERMISSION_ADDED_IN: Partial<Record<Permission, number>> = {};

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function isRole(value: string): value is RoleName {
  return (ROLES as readonly string[]).includes(value);
}

export function defaultPermissionsFor(role: RoleName): Permission[] {
  if (role === "DEVELOPER") return [...PERMISSIONS];
  return [...DEFAULT_GRANTS[role]];
}

/** True when the matrix may store this permission for the role. */
export function canBeGranted(role: RoleName, permission: Permission): boolean {
  if (role === "DEVELOPER") return true;
  return !NEVER_GRANTABLE.includes(permission);
}
