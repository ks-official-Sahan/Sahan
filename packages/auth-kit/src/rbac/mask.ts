// Masking: an account holding the super role can be shown to everyone else as
// another role (`maskAs`, e.g. SUPER_ADMIN). Presentation only: every
// authorization decision (permissions, canManage, the last-super-role rule)
// keeps using the real role. Apps run what they send to a viewer through this
// on the server, in one place. Pure, so every rule is unit tested.
//
// Off unless the policy says `enabled: true`. Apps resolve that from
// ADMIN_PRESENTATION_MODE with `presentationModeOn` (exactly "true"; anything
// else, or unset, is off). While off, every role shows as it is, every role
// row and count is real, audit rows are readable by role permissions alone,
// and stored mask flags are ignored until it is turned on again.

/** The environment variable that turns masking on. */
export const PRESENTATION_MODE_ENV = "ADMIN_PRESENTATION_MODE";

/** Whether a PRESENTATION_MODE_ENV value turns masking on: only the exact value "true" (trimmed). */
export function presentationModeOn(value: string | undefined | null): boolean {
  return value?.trim() === "true";
}

export interface MaskPolicy<TRole extends string> {
  superRole: TRole;
  maskAs: NoInfer<TRole>;
  /** Off by default; see presentationModeOn. */
  enabled?: boolean;
}

export interface MaskState {
  /** Every super-role account is masked. */
  global: boolean;
  /** Super-role accounts masked one by one (user ids). */
  users: ReadonlySet<string>;
}

/** No account masked: the state to pass while masking is off, or nothing is stored yet. */
export const NO_MASKS: MaskState = { global: false, users: new Set() };

interface Viewer<TRole extends string> {
  role: TRole;
}

interface Subject<TRole extends string> {
  id: string;
  role: TRole;
}

export interface Mask<TRole extends string> {
  /** Whether masking is on at all. */
  enabled: boolean;
  /** The super role sees real roles, every mask and the toggles. */
  seesThrough(viewer: Viewer<TRole>): boolean;
  isMasked(person: Subject<TRole>): boolean;
  /** The role `viewer` is shown for `person`. */
  roleFor(viewer: Viewer<TRole>, person: Subject<TRole>): TRole;
  /** `person` with its role replaced by the one `viewer` is shown (the same object when unchanged). */
  present<T extends Subject<TRole>>(viewer: Viewer<TRole>, person: T): T;
  /**
   * Roles `viewer` may see listed. The super role's row is hidden from
   * everyone else while every super-role account is masked
   * (`unmaskedSuperUsers` is how many are not).
   */
  visibleRoles<T extends { name: string }>(viewer: Viewer<TRole>, roles: readonly T[], unmaskedSuperUsers: number): T[];
  /** Users per role as `viewer` sees them: masked super-role accounts count under `maskAs`. */
  presentCounts(viewer: Viewer<TRole>, counts: Readonly<Record<string, number>>, maskedSuperUsers: number): Record<string, number>;
  /**
   * Whether `viewer` may see an audit row written by a user holding
   * `actorRole` at the time (the row's snapshot). While masking is on, rows
   * by the super role are for the super role only, masked or not.
   */
  canSeeAuditBy(viewer: Viewer<TRole>, actorRole: string | null): boolean;
  /** The author role whose audit rows `viewer` may not read, for a query filter; undefined when none. */
  hiddenAuditRole(viewer: Viewer<TRole>): TRole | undefined;
}

export function createMask<TRole extends string>(policy: MaskPolicy<TRole>, state: MaskState = NO_MASKS): Mask<TRole> {
  const { superRole, maskAs } = policy;
  const enabled = policy.enabled === true;
  const seesThrough = (viewer: Viewer<TRole>) => viewer.role === superRole;
  const isMasked = (person: Subject<TRole>) => enabled && person.role === superRole && (state.global || state.users.has(person.id));
  const roleFor = (viewer: Viewer<TRole>, person: Subject<TRole>) => (!seesThrough(viewer) && isMasked(person) ? maskAs : person.role);
  const hiddenAuditRole = (viewer: Viewer<TRole>) => (enabled && !seesThrough(viewer) ? superRole : undefined);

  return {
    enabled,
    seesThrough,
    isMasked,
    roleFor,
    present(viewer, person) {
      const role = roleFor(viewer, person);
      return role === person.role ? person : { ...person, role };
    },
    visibleRoles(viewer, roles, unmaskedSuperUsers) {
      if (!enabled || seesThrough(viewer) || (!state.global && unmaskedSuperUsers > 0)) return [...roles];
      return roles.filter((role) => role.name !== superRole);
    },
    presentCounts(viewer, counts, maskedSuperUsers) {
      const out = { ...counts };
      if (!enabled || seesThrough(viewer) || maskedSuperUsers <= 0) return out;
      const remaining = (out[superRole] ?? 0) - maskedSuperUsers;
      out[maskAs] = (out[maskAs] ?? 0) + maskedSuperUsers;
      if (remaining > 0) out[superRole] = remaining;
      else delete out[superRole];
      return out;
    },
    canSeeAuditBy(viewer, actorRole) {
      return hiddenAuditRole(viewer) === undefined || actorRole !== superRole;
    },
    hiddenAuditRole,
  };
}
