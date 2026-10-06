import type { Metadata } from "next";

import MatrixForm, { type MatrixGroup } from "@/components/admin/roles/MatrixForm";
import RolesManager from "@/components/admin/roles/RolesManager";
import { requirePermission } from "@/lib/auth/dal";
import { NEVER_GRANTABLE, PERMISSIONS, PERMISSION_INFO, SUPER_ROLE } from "@/lib/auth/permissions";
import { loadMatrix } from "@/lib/auth/rbac";
import { getRoleCatalog } from "@/lib/auth/roles";
import { repos } from "@/lib/data";

export const metadata: Metadata = { title: "Roles and permissions" };

export default async function RolesPage() {
  await requirePermission("managePermissions");
  const [catalog, matrix, userCounts] = await Promise.all([getRoleCatalog(), loadMatrix(), repos.roles.userCounts()]);
  const editable = catalog.roles.filter((role) => role.name !== SUPER_ROLE);

  const groups: MatrixGroup[] = [];
  for (const permission of PERMISSIONS) {
    const info = PERMISSION_INFO[permission];
    let group = groups.find((entry) => entry.group === info.group);
    if (!group) groups.push((group = { group: info.group, items: [] }));
    group.items.push({
      permission,
      label: info.label,
      description: info.description,
      granted: editable.filter((role) => matrix[role.name]?.has(permission)).map((role) => role.name),
      locked: NEVER_GRANTABLE.includes(permission),
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roles and permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who exists and what each role can do. A developer always holds every permission, so a wrong edit here cannot lock
          the owner out. Changes apply within a minute and are written to the audit log.
        </p>
      </div>

      <section aria-labelledby="roles-heading" className="space-y-3">
        <h2 id="roles-heading" className="text-base font-medium">
          Roles
        </h2>
        <RolesManager roles={catalog.roles.map((role) => ({ ...role, users: userCounts[role.name] ?? 0 }))} superRole={SUPER_ROLE} />
      </section>

      <section aria-labelledby="matrix-heading" className="space-y-3">
        <h2 id="matrix-heading" className="text-base font-medium">
          Permissions
        </h2>
        <MatrixForm
          superLabel={catalog.get(SUPER_ROLE)?.label ?? "Developer"}
          roles={editable.map((role) => ({ name: role.name, label: role.label }))}
          groups={groups}
        />
      </section>
    </div>
  );
}
