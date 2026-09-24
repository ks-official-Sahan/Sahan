import Link from "next/link";

import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import EmptyState from "@/components/admin/ui/EmptyState";
import { badgeClass, buttonVariants, tableClass, tdClass, thClass } from "@/components/admin/ui/styles";

export default async function ExperiencePage() {
  await requirePermission("editCollections");

  const experiences = await db.experience.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Experience</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage work history and experience entries</p>
        </div>
        <Link href="/admin/works/experience/new" className={buttonVariants.primary}>
          Add Experience
        </Link>
      </div>

      {experiences.length === 0 ? (
        <EmptyState
          title="No experience entries yet"
          description="Create your first work history entry."
          action={
            <Link href="/admin/works/experience/new" className={buttonVariants.primary}>
              Create your first entry
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className={tableClass}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th scope="col" className={thClass}>
                  Company
                </th>
                <th scope="col" className={thClass}>
                  Role
                </th>
                <th scope="col" className={thClass}>
                  Period
                </th>
                <th scope="col" className={thClass}>
                  Type
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
              {experiences.map((exp) => (
                <tr key={exp.id} className="hover:bg-muted/40">
                  <td className={`${tdClass} font-medium`}>{exp.company}</td>
                  <td className={tdClass}>{exp.role}</td>
                  <td className={`${tdClass} text-muted-foreground`}>{exp.period}</td>
                  <td className={`${tdClass} capitalize`}>{exp.type}</td>
                  <td className={tdClass}>
                    <span className={badgeClass}>{exp.published ? "Yes" : "Draft"}</span>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Link
                      href={`/admin/works/experience/${exp.id}`}
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
