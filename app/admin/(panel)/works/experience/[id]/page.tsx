import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import ActionForm, { ConfirmSubmitButton, SubmitButton } from "@/components/admin/ui/ActionForm";
import ExperienceForm, { type EditableExperience } from "@/components/admin/works/ExperienceForm";
import { badgeClass, buttonVariants, cardClass } from "@/components/admin/ui/styles";
import {
  deleteExperienceAction,
  publishExperienceAction,
  updateExperienceAction,
} from "@/lib/actions/works";
import type { ActionState } from "@/lib/actions/state";
import { hasPermission, requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Edit Experience Entry", robots: "noindex, nofollow, nocache" };

export default async function EditExperiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("editCollections");

  const experience = await db.experience.findUnique({ where: { id } });
  if (!experience) notFound();

  const canPublish = hasPermission(user, "publishCollections");

  async function update(previous: ActionState, formData: FormData): Promise<ActionState> {
    "use server";
    const result = await updateExperienceAction(previous, formData);
    if (result.ok) redirect("/admin/works/experience");
    return result;
  }

  async function remove(previous: ActionState, formData: FormData): Promise<ActionState> {
    "use server";
    const result = await deleteExperienceAction(previous, formData);
    if (result.ok) redirect("/admin/works/experience");
    return result;
  }

  const editable: EditableExperience = {
    id: experience.id,
    company: experience.company,
    companyUrl: experience.companyUrl ?? "",
    role: experience.role,
    period: experience.period,
    type: experience.type as EditableExperience["type"],
    location: experience.location ?? "",
    highlights: experience.highlights,
    current: experience.current,
  };

  const sidePanel = (
    <div className={cardClass}>
      <h2 className="mb-3 text-sm font-semibold">Status</h2>
      {canPublish ? (
        <ActionForm action={publishExperienceAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={experience.id} />
          <input type="hidden" name="publish" value={experience.published ? "false" : "true"} />
          <SubmitButton variant="secondary" pendingLabel="Working…">
            {experience.published ? "Unpublish" : "Publish"}
          </SubmitButton>
          <span className={badgeClass}>{experience.published ? "Published" : "Draft"}</span>
        </ActionForm>
      ) : (
        <span className={badgeClass}>{experience.published ? "Published" : "Draft"}</span>
      )}

      {canPublish ? (
        <ActionForm action={remove} className="mt-4 border-t border-border pt-4">
          <input type="hidden" name="id" value={experience.id} />
          <ConfirmSubmitButton
            variant="danger"
            pendingLabel="Deleting…"
            className="w-full"
            confirmMessage={`Delete the ${experience.company} entry? This cannot be undone.`}
          >
            Delete entry
          </ConfirmSubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{experience.company}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{experience.role}</p>
        </div>
        <Link href="/admin/works/experience" className={buttonVariants.secondary}>
          Back to Experience
        </Link>
      </div>

      <ExperienceForm action={update} experience={editable} sidePanel={sidePanel} />
    </div>
  );
}
