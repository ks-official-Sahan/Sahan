import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import ActionForm, { ConfirmSubmitButton, SubmitButton } from "@/components/admin/ui/ActionForm";
import ProjectForm, { type EditableProject } from "@/components/admin/works/ProjectForm";
import { badgeClass, buttonVariants, cardClass } from "@/components/admin/ui/styles";
import {
  deleteProjectAction,
  featureProjectAction,
  publishProjectAction,
  updateProjectAction,
} from "@/lib/actions/works";
import type { ActionState } from "@/lib/actions/state";
import { hasPermission, requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import type { ProjectImage, ProjectLink } from "@/types/project";

export const metadata: Metadata = { title: "Edit Project", robots: "noindex, nofollow, nocache" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("editCollections");

  const project = await db.project.findUnique({ where: { id } });
  if (!project) notFound();

  const canPublish = hasPermission(user, "publishCollections");

  async function update(previous: ActionState, formData: FormData): Promise<ActionState> {
    "use server";
    const result = await updateProjectAction(previous, formData);
    if (result.ok) redirect("/admin/works/projects");
    return result;
  }

  async function remove(previous: ActionState, formData: FormData): Promise<ActionState> {
    "use server";
    const result = await deleteProjectAction(previous, formData);
    if (result.ok) redirect("/admin/works/projects");
    return result;
  }

  const editable: EditableProject = {
    id: project.id,
    slug: project.slug,
    title: project.title,
    tagline: project.tagline,
    description: project.description,
    role: project.role,
    organization: project.organization ?? "",
    organizationUrl: project.organizationUrl ?? "",
    category: project.category as EditableProject["category"],
    status: project.status as EditableProject["status"],
    platforms: project.platforms as EditableProject["platforms"],
    tech: project.tech,
    year: project.year,
    image: (project.image as unknown as ProjectImage | null) ?? null,
    links: (project.links as unknown as ProjectLink[]) ?? [],
  };

  const sidePanel = (
    <div className={cardClass}>
      <h2 className="mb-3 text-sm font-semibold">Status</h2>
      {canPublish ? (
        <div className="space-y-2">
          <ActionForm action={publishProjectAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={project.id} />
            <input type="hidden" name="publish" value={project.published ? "false" : "true"} />
            <SubmitButton variant="secondary" pendingLabel="Working…">
              {project.published ? "Unpublish" : "Publish"}
            </SubmitButton>
            <span className={badgeClass}>{project.published ? "Published" : "Draft"}</span>
          </ActionForm>
          <ActionForm action={featureProjectAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={project.id} />
            <input type="hidden" name="featured" value={project.featured ? "false" : "true"} />
            <SubmitButton variant="secondary" pendingLabel="Working…">
              {project.featured ? "Unfeature" : "Feature"}
            </SubmitButton>
            {project.featured ? <span className={badgeClass}>Featured</span> : null}
          </ActionForm>
        </div>
      ) : (
        <span className={badgeClass}>{project.published ? "Published" : "Draft"}</span>
      )}

      {canPublish ? (
        <ActionForm action={remove} className="mt-4 border-t border-border pt-4">
          <input type="hidden" name="id" value={project.id} />
          <ConfirmSubmitButton
            variant="danger"
            pendingLabel="Deleting…"
            className="w-full"
            confirmMessage={`Delete "${project.title}"? This cannot be undone.`}
          >
            Delete project
          </ConfirmSubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">/works/{project.slug}</p>
        </div>
        <Link href="/admin/works/projects" className={buttonVariants.secondary}>
          Back to Projects
        </Link>
      </div>

      <ProjectForm action={update} project={editable} sidePanel={sidePanel} />
    </div>
  );
}
