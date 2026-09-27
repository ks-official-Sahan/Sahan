import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import EmptyState from "@/components/admin/ui/EmptyState";
import { buttonVariants, tableClass, tdClass, thClass } from "@/components/admin/ui/styles";

export const metadata: Metadata = { title: "Services", robots: "noindex, nofollow, nocache" };

export default async function ServicesPage() {
  await requirePermission("editCollections");
  const groups = await db.serviceGroup.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      services: { select: { published: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Link href="/admin/works" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to Works
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage service groups and the services inside them</p>
        </div>
        <Link href="/admin/works/services/create" className={buttonVariants.primary}>
          New Service Group
        </Link>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No service groups yet"
          description="Create a group, then add services to it."
          action={
            <Link href="/admin/works/services/create" className={buttonVariants.primary}>
              Create your first group
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className={tableClass}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th scope="col" className={thClass}>
                  Group
                </th>
                <th scope="col" className={thClass}>
                  Services
                </th>
                <th scope="col" className={thClass}>
                  Published
                </th>
                <th scope="col" className={thClass}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((group) => (
                <tr key={group.id} className="hover:bg-muted/40">
                  <td className={`${tdClass} font-medium`}>{group.name}</td>
                  <td className={`${tdClass} text-muted-foreground`}>{group.services.length}</td>
                  <td className={`${tdClass} text-muted-foreground`}>
                    {group.services.filter((service) => service.published).length} / {group.services.length}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Link
                      href={`/admin/works/services/${group.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
