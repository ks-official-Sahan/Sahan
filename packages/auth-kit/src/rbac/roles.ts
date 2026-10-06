import type { Person } from "../kit";

// Runtime roles: rows in the `roles` table instead of a fixed list in code.
// Pure: the app loads the rows (and caches them); everything here is a sync
// decision over that list, so a request loads roles once and asks many
// questions. Hierarchy is the rank: a lower rank manages strictly higher
// ranks. The super role is named in code and manages everyone.

export interface RoleRecord {
  name: string;
  label: string;
  description: string | null;
  /** 0 is the super role; every other role is 1 or more. Lower manages higher. */
  rank: number;
  /** Built in: cannot be renamed or deleted. */
  system: boolean;
}

/** Upper-case letters, digits and underscores, starting with a letter: safe in URLs, form names and logs. */
export const ROLE_NAME_PATTERN = /^[A-Z][A-Z0-9_]{1,31}$/;
export const MAX_ROLE_RANK = 1000;
export const MAX_ROLE_LABEL = 60;
export const MAX_ROLE_DESCRIPTION = 300;

export interface RoleCatalog<TRole extends string = string> {
  /** Every role, highest first (rank, then name). */
  readonly roles: readonly RoleRecord[];
  readonly names: readonly TRole[];
  has(name: string): name is TRole;
  get(name: string): RoleRecord | undefined;
  /** Never themselves. The super role manages everyone; anyone else only strictly lower roles. */
  canManage(actor: Person<TRole>, target: Person<TRole>): boolean;
  /** Roles the actor may give: every role for the super role, else strictly lower ones. */
  assignable(actorRole: TRole): TRole[];
}

export function createRoleCatalog<TRole extends string = string>(records: readonly RoleRecord[], superRole: TRole): RoleCatalog<TRole> {
  const roles = [...records].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  const byName = new Map(roles.map((role) => [role.name, role]));
  const rankOf = (name: string) => (name === superRole ? 0 : byName.get(name)?.rank);
  return {
    roles,
    names: roles.map((role) => role.name as TRole),
    has: (name): name is TRole => byName.has(name),
    get: (name) => byName.get(name),
    canManage(actor, target) {
      if (actor.id === target.id) return false;
      if (actor.role === superRole) return true;
      const mine = rankOf(actor.role);
      const theirs = rankOf(target.role);
      // An unknown role on either side fails closed.
      return mine !== undefined && theirs !== undefined && mine < theirs;
    },
    assignable(actorRole) {
      if (actorRole === superRole) return roles.map((role) => role.name as TRole);
      const mine = rankOf(actorRole);
      if (mine === undefined) return [];
      return roles.filter((role) => role.rank > mine).map((role) => role.name as TRole);
    },
  };
}

export interface RoleInput {
  name: string;
  label: string;
  description?: string | null;
  rank: number;
}

export type RoleInputCheck = { ok: true; value: RoleInput } | { ok: false; field: keyof RoleInput; error: string };

/**
 * Checks a new or edited role. `existing` is the current list; pass the
 * role's own name as `editing` when updating it, so its name does not
 * collide with itself.
 */
export function checkRoleInput(input: RoleInput, existing: readonly RoleRecord[], editing?: string): RoleInputCheck {
  const name = input.name.trim().toUpperCase();
  const label = input.label.trim();
  const description = input.description?.trim() || null;
  if (!ROLE_NAME_PATTERN.test(name)) {
    return { ok: false, field: "name", error: "Use 2 to 32 capital letters, digits or underscores, starting with a letter." };
  }
  if (name !== editing && existing.some((role) => role.name === name)) return { ok: false, field: "name", error: "That role already exists." };
  if (!label || label.length > MAX_ROLE_LABEL) return { ok: false, field: "label", error: `Give it a label of up to ${MAX_ROLE_LABEL} characters.` };
  if (description && description.length > MAX_ROLE_DESCRIPTION) {
    return { ok: false, field: "description", error: `Use at most ${MAX_ROLE_DESCRIPTION} characters.` };
  }
  if (!Number.isInteger(input.rank) || input.rank < 1 || input.rank > MAX_ROLE_RANK) {
    return { ok: false, field: "rank", error: `Rank is a whole number from 1 to ${MAX_ROLE_RANK}.` };
  }
  return { ok: true, value: { name, label, description, rank: input.rank } };
}
