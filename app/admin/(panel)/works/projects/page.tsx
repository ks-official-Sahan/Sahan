import type { Metadata } from "next";
import Link from "next/link";

import ActionForm, { SubmitButton } from "@/components/admin/ui/ActionForm";
import { featureProjectAction, publishProjectAction, reorderProjectAction } from "@/lib/actions/works";
import { hasPermission, requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import EmptyState from "@/components/admin/ui/EmptyState";
import { badgeClass, buttonVariants, tableClass, tdClass, thClass } from "@/components/admin/ui/styles";

export const metadata: Metadata = { title: "Projects", robots: "noindex, nofollow, nocache" };

export default async function ProjectsPage() {
  const user = await requirePermission("editCollections");
  // publishCollections gates publish/feature/reorder (authorizeAction inside
  // each action) but not editCollections, which only covers create/update —
  // an EDITOR has the latter without the former, so these controls are
  // hidden rather than rendered disabled-on-submit.
  const canPublish = hasPermission(user, "publishCollections");

  const projects = await db.project.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, category: true, status: true, published: true, featured: true, sortOrder: true },
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Link href="/admin/works" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to Works
      </Link>
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
                  Order
                </th>
                <th scope="col" className={thClass}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projects.map((project, index) => (
                <tr key={project.id} className="hover:bg-muted/40">
                  <td className={`${tdClass} font-medium`}>{project.title}</td>
                  <td className={`${tdClass} text-muted-foreground`}>{project.category}</td>
                  <td className={tdClass}>{project.status}</td>
                  <td className={tdClass}>
                    {canPublish ? (
                      <ActionForm action={publishProjectAction} showMessage={false}>
                        <input type="hidden" name="id" value={project.id} />
                        <input type="hidden" name="publish" value={project.published ? "false" : "true"} />
                        <SubmitButton variant="small" pendingLabel="…">
                          {project.published ? "Published" : "Draft"}
                        </SubmitButton>
                      </ActionForm>
                    ) : (
                      <span className={badgeClass}>{project.published ? "Published" : "Draft"}</span>
                    )}
                  </td>
                  <td className={tdClass}>
                    {canPublish ? (
                      <ActionForm action={featureProjectAction} showMessage={false}>
                        <input type="hidden" name="id" value={project.id} />
                        <input type="hidden" name="featured" value={project.featured ? "false" : "true"} />
                        <SubmitButton
                          variant="small"
                          className={project.featured ? undefined : "text-muted-foreground"}
                          pendingLabel="…"
                        >
                          {project.featured ? "Featured" : "Feature"}
                        </SubmitButton>
                      </ActionForm>
                    ) : project.featured ? (
                      <span className={badgeClass}>Featured</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={tdClass}>
                    {canPublish ? (
                      <div className="flex items-center gap-1">
                        {index === 0 ? (
                          <button type="button" disabled aria-hidden className={`${buttonVariants.small} opacity-30`}>
                            ↑
                          </button>
                        ) : (
                          <ActionForm action={reorderProjectAction} showMessage={false}>
                            <input type="hidden" name="id" value={project.id} />
                            <input type="hidden" name="direction" value="up" />
                            <SubmitButton variant="small" pendingLabel="…">
                              <span aria-hidden>↑</span>
                              <span className="sr-only">Move {project.title} up</span>
                            </SubmitButton>
                          </ActionForm>
                        )}
                        {index === projects.length - 1 ? (
                          <button type="button" disabled aria-hidden className={`${buttonVariants.small} opacity-30`}>
                            ↓
                          </button>
                        ) : (
                          <ActionForm action={reorderProjectAction} showMessage={false}>
                            <input type="hidden" name="id" value={project.id} />
                            <input type="hidden" name="direction" value="down" />
                            <SubmitButton variant="small" pendingLabel="…">
                              <span aria-hidden>↓</span>
                              <span className="sr-only">Move {project.title} down</span>
                            </SubmitButton>
                          </ActionForm>
                        )}
                      </div>
                    ) : null}
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
