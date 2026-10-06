// Masking: an account holding the super role can be shown to everyone else as
// another role (`maskAs`, e.g. SUPER_ADMIN). Presentation only: every
// authorization decision (permissions, canManage, the last-super-role rule)
// keeps using the real role. Apps run what they send to a viewer through this
// on the server, in one place. Opt-in: an app that never calls it shows real
// roles. Pure, so every rule is unit tested.

export interface MaskState {
  /** Every super-role account is masked. */
  global: boolean;
  /** Super-role accounts masked one by one (user ids). */
  users: ReadonlySet<string>;
}

interface Viewer<TRole extends string> {
  role: TRole;
}
interface Subject<TRole extends string> {
  id: string;
  role: TRole;
}

export interface Mask<TRole extends string> {
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
   * `actorRole` at the time (the row's snapshot). Rows by the super role are
   * for the super role only, masked or not.
   */
  canSeeAuditBy(viewer: Viewer<TRole>, actorRole: string | null): boolean;
}

export function createMask<TRole extends string>(policy: { superRole: TRole; maskAs: NoInfer<TRole> }, state: MaskState): Mask<TRole> {
  const { superRole, maskAs } = policy;
  const seesThrough = (viewer: Viewer<TRole>) => viewer.role === superRole;
  const isMasked = (person: Subject<TRole>) => person.role === superRole && (state.global || state.users.has(person.id));
  const roleFor = (viewer: Viewer<TRole>, person: Subject<TRole>) => (!seesThrough(viewer) && isMasked(person) ? maskAs : person.role);

  return {
    seesThrough,
    isMasked,
    roleFor,
    present(viewer, person) {
      const role = roleFor(viewer, person);
      return role === person.role ? person : { ...person, role };
    },
    visibleRoles(viewer, roles, unmaskedSuperUsers) {
      if (seesThrough(viewer) || (!state.global && unmaskedSuperUsers > 0)) return [...roles];
      return roles.filter((role) => role.name !== superRole);
    },
    presentCounts(viewer, counts, maskedSuperUsers) {
      const out = { ...counts };
      if (seesThrough(viewer) || maskedSuperUsers <= 0) return out;
      const remaining = (out[superRole] ?? 0) - maskedSuperUsers;
      out[maskAs] = (out[maskAs] ?? 0) + maskedSuperUsers;
      if (remaining > 0) out[superRole] = remaining;
      else delete out[superRole];
      return out;
    },
    canSeeAuditBy(viewer, actorRole) {
      return seesThrough(viewer) || actorRole !== superRole;
    },
  };
}
