import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import ActionForm, { ConfirmSubmitButton, Field, SubmitButton } from "@/components/admin/ui/ActionForm";
import { badgeClass, buttonVariants, cardClass, fieldClass } from "@/components/admin/ui/styles";
import {
  createSkillAction,
  deleteSkillAction,
  deleteSkillGroupAction,
  publishSkillAction,
  reorderSkillAction,
  updateSkillAction,
  updateSkillGroupAction,
} from "@/lib/actions/works";
import type { ActionState } from "@/lib/actions/state";
import { hasPermission, requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit Skill Group", robots: "noindex, nofollow, nocache" };

export default async function EditSkillGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("editCollections");
  const canPublish = hasPermission(user, "publishCollections");

  const group = await db.skillGroup.findUnique({
    where: { id },
    include: { skills: { orderBy: { sortOrder: "asc" } } },
  });
  if (!group) notFound();

  async function saveGroup(previous: ActionState, formData: FormData): Promise<ActionState> {
    "use server";
    return updateSkillGroupAction(previous, formData);
  }

  async function removeGroup(previous: ActionState, formData: FormData): Promise<ActionState> {
    "use server";
    const result = await deleteSkillGroupAction(previous, formData);
    if (result.ok) redirect("/admin/works/skills");
    return result;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{group.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{group.key}</span> · {group.skills.length} skill(s)
          </p>
        </div>
        <Link href="/admin/works/skills" className={buttonVariants.secondary}>
          Back to Skills
        </Link>
      </div>

      <div className={cardClass}>
        <h2 className="mb-3 text-sm font-semibold">Group</h2>
        <ActionForm action={saveGroup} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={group.id} />
          <Field label="Label" name="label" required defaultValue={group.label} className="min-w-56 flex-1" />
          <SubmitButton variant="secondary" pendingLabel="Saving…">
            Save label
          </SubmitButton>
        </ActionForm>

        {canPublish ? (
          <ActionForm action={removeGroup} className="mt-4 border-t border-border pt-4">
            <input type="hidden" name="id" value={group.id} />
            <ConfirmSubmitButton
              variant="danger"
              pendingLabel="Deleting…"
              confirmMessage={`Delete "${group.label}" and its ${group.skills.length} skill(s)? This cannot be undone.`}
            >
              Delete group
            </ConfirmSubmitButton>
          </ActionForm>
        ) : null}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Skills</h2>

        {group.skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills in this group yet.</p>
        ) : (
          group.skills.map((skill, index) => (
            <div key={skill.id} className={cardClass}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{skill.name}</span>
                <div className="flex items-center gap-2">
                  <span className={badgeClass}>{skill.published ? "Published" : "Draft"}</span>
                  {canPublish ? (
                    <div className="flex items-center gap-1">
                      {index === 0 ? (
                        <button type="button" disabled aria-hidden className={`${buttonVariants.small} opacity-30`}>
                          ↑
                        </button>
                      ) : (
                        <ActionForm action={reorderSkillAction} showMessage={false}>
                          <input type="hidden" name="id" value={skill.id} />
                          <input type="hidden" name="direction" value="up" />
                          <SubmitButton variant="small" pendingLabel="…">
                            <span aria-hidden>↑</span>
                            <span className="sr-only">Move {skill.name} up</span>
                          </SubmitButton>
                        </ActionForm>
                      )}
                      {index === group.skills.length - 1 ? (
                        <button type="button" disabled aria-hidden className={`${buttonVariants.small} opacity-30`}>
                          ↓
                        </button>
                      ) : (
                        <ActionForm action={reorderSkillAction} showMessage={false}>
                          <input type="hidden" name="id" value={skill.id} />
                          <input type="hidden" name="direction" value="down" />
                          <SubmitButton variant="small" pendingLabel="…">
                            <span aria-hidden>↓</span>
                            <span className="sr-only">Move {skill.name} down</span>
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <ActionForm action={updateSkillAction} className="mt-3 grid grid-cols-1 gap-3 s768:grid-cols-2">
                <input type="hidden" name="id" value={skill.id} />
                <Field label="Name" name="name" required defaultValue={skill.name} />
                <Field label="Abbreviation" name="abbr" required defaultValue={skill.abbr} />
                <Field label="Sub-group (type)" name="type" required defaultValue={skill.type} hint="e.g. frontend" />
                <Field label="Icon key" name="iconKey" required defaultValue={skill.iconKey} />
                <div>
                  <label htmlFor={`skill-variant-${skill.id}`} className="text-sm font-medium">
                    Icon variant
                  </label>
                  <select
                    id={`skill-variant-${skill.id}`}
                    name="variant"
                    defaultValue={skill.variant}
                    className={cn(fieldClass, "mt-1.5")}
                  >
                    <option value="fill">Fill</option>
                    <option value="stroke">Stroke</option>
                  </select>
                </div>
                <div />
                <Field label="Color (light mode)" name="colorLight" required defaultValue={skill.colorLight} placeholder="#000000" />
                <Field label="Color (dark mode)" name="colorDark" required defaultValue={skill.colorDark} placeholder="#ffffff" />
                <SubmitButton variant="secondary" pendingLabel="Saving…">
                  Save skill
                </SubmitButton>
              </ActionForm>

              {canPublish ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <ActionForm action={publishSkillAction}>
                    <input type="hidden" name="id" value={skill.id} />
                    <input type="hidden" name="publish" value={skill.published ? "false" : "true"} />
                    <SubmitButton variant="small" pendingLabel="Working…">
                      {skill.published ? "Unpublish" : "Publish"}
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={deleteSkillAction}>
                    <input type="hidden" name="id" value={skill.id} />
                    <ConfirmSubmitButton
                      variant="smallDanger"
                      pendingLabel="Deleting…"
                      confirmMessage={`Delete "${skill.name}"? This cannot be undone.`}
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </ActionForm>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className={cardClass}>
        <h2 className="mb-3 text-sm font-semibold">Add a skill</h2>
        <ActionForm action={createSkillAction} className="grid grid-cols-1 gap-3 s768:grid-cols-2">
          <input type="hidden" name="groupId" value={group.id} />
          <Field label="Name" name="name" required />
          <Field label="Abbreviation" name="abbr" required />
          <Field label="Sub-group (type)" name="type" required hint="e.g. frontend" />
          <Field label="Icon key" name="iconKey" required />
          <div>
            <label htmlFor="new-skill-variant" className="text-sm font-medium">
              Icon variant
            </label>
            <select id="new-skill-variant" name="variant" defaultValue="fill" className={cn(fieldClass, "mt-1.5")}>
              <option value="fill">Fill</option>
              <option value="stroke">Stroke</option>
            </select>
          </div>
          <div />
          <Field label="Color (light mode)" name="colorLight" required placeholder="#000000" />
          <Field label="Color (dark mode)" name="colorDark" required placeholder="#ffffff" />
          <SubmitButton pendingLabel="Adding…" className="s768:col-span-2">
            Add skill
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
