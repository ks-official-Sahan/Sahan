import Link from "next/link";

import { requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import EmptyState from "@/components/admin/ui/EmptyState";
import { badgeClass, buttonVariants, tableClass, tdClass, thClass } from "@/components/admin/ui/styles";

export default async function ProjectsPage() {
  await requirePermission("editCollections");

  const projects = await db.project.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage portfolio projects</p>
        </div>
        <Link href="/admin/works/projects/new" className={buttonVariants.primary}>
          Add Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first portfolio project."
          action={
            <Link href="/admin/works/projects/new" className={buttonVariants.primary}>
              Create your first project
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className={tableClass}>
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th scope="col" className={thClass}>
                  Title
                </th>
                <th scope="col" className={thClass}>
                  Category
                </th>
                <th scope="col" className={thClass}>
                  Status
                </th>
                <th scope="col" className={thClass}>
                  Published
                </th>
                <th scope="col" className={thClass}>
                  Featured
                </th>
                <th scope="col" className={thClass}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-muted/40">
                  <td className={`${tdClass} font-medium`}>{project.title}</td>
                  <td className={`${tdClass} text-muted-foreground`}>{project.category}</td>
                  <td className={tdClass}>{project.status}</td>
                  <td className={tdClass}>
                    <span className={badgeClass}>{project.published ? "Yes" : "Draft"}</span>
                  </td>
                  <td className={tdClass}>
                    {project.featured ? (
                      <span className={badgeClass}>Featured</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Link
                      href={`/admin/works/projects/${project.id}`}
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
