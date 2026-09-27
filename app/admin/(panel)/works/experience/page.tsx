import type { Metadata } from "next";
import Link from "next/link";

import ActionForm, { SubmitButton } from "@/components/admin/ui/ActionForm";
import { publishExperienceAction, reorderExperienceAction } from "@/lib/actions/works";
import { hasPermission, requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import EmptyState from "@/components/admin/ui/EmptyState";
import { badgeClass, buttonVariants, tableClass, tdClass, thClass } from "@/components/admin/ui/styles";

export const metadata: Metadata = { title: "Experience", robots: "noindex, nofollow, nocache" };

export default async function ExperiencePage() {
  const user = await requirePermission("editCollections");
  const canPublish = hasPermission(user, "publishCollections");

  const experiences = await db.experience.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, company: true, role: true, period: true, type: true, published: true, sortOrder: true },
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Link href="/admin/works" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to Works
      </Link>
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
                  Order
                </th>
                <th scope="col" className={thClass}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {experiences.map((exp, index) => (
                <tr key={exp.id} className="hover:bg-muted/40">
                  <td className={`${tdClass} font-medium`}>{exp.company}</td>
                  <td className={tdClass}>{exp.role}</td>
                  <td className={`${tdClass} text-muted-foreground`}>{exp.period}</td>
                  <td className={`${tdClass} capitalize`}>{exp.type}</td>
                  <td className={tdClass}>
                    {canPublish ? (
                      <ActionForm action={publishExperienceAction} showMessage={false}>
                        <input type="hidden" name="id" value={exp.id} />
                        <input type="hidden" name="publish" value={exp.published ? "false" : "true"} />
                        <SubmitButton variant="small" pendingLabel="…">
                          {exp.published ? "Published" : "Draft"}
                        </SubmitButton>
                      </ActionForm>
                    ) : (
                      <span className={badgeClass}>{exp.published ? "Published" : "Draft"}</span>
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
                          <ActionForm action={reorderExperienceAction} showMessage={false}>
                            <input type="hidden" name="id" value={exp.id} />
                            <input type="hidden" name="direction" value="up" />
                            <SubmitButton variant="small" pendingLabel="…">
                              <span aria-hidden>↑</span>
                              <span className="sr-only">Move {exp.company} up</span>
                            </SubmitButton>
                          </ActionForm>
                        )}
                        {index === experiences.length - 1 ? (
                          <button type="button" disabled aria-hidden className={`${buttonVariants.small} opacity-30`}>
                            ↓
                          </button>
                        ) : (
                          <ActionForm action={reorderExperienceAction} showMessage={false}>
                            <input type="hidden" name="id" value={exp.id} />
                            <input type="hidden" name="direction" value="down" />
                            <SubmitButton variant="small" pendingLabel="…">
                              <span aria-hidden>↓</span>
                              <span className="sr-only">Move {exp.company} down</span>
                            </SubmitButton>
                          </ActionForm>
                        )}
                      </div>
                    ) : null}
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
