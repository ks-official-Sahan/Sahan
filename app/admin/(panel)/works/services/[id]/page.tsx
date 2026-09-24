import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import ActionForm, { ConfirmSubmitButton, Field, SubmitButton } from "@/components/admin/ui/ActionForm";
import { badgeClass, buttonVariants, cardClass } from "@/components/admin/ui/styles";
import {
  createServiceAction,
  deleteServiceAction,
  deleteServiceGroupAction,
  publishServiceAction,
  reorderServiceAction,
  updateServiceAction,
  updateServiceGroupAction,
} from "@/lib/actions/works";
import type { ActionState } from "@/lib/actions/state";
import { hasPermission, requirePermission } from "@/lib/auth/dal";
import { db } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Edit Service Group", robots: "noindex, nofollow, nocache" };

export default async function EditServiceGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("editCollections");
  const canPublish = hasPermission(user, "publishCollections");

  const group = await db.serviceGroup.findUnique({
    where: { id },
    include: { services: { orderBy: { sortOrder: "asc" } } },
  });
  if (!group) notFound();

  async function saveGroup(previous: ActionState, formData: FormData): Promise<ActionState> {
    "use server";
    return updateServiceGroupAction(previous, formData);
  }

  async function removeGroup(previous: ActionState, formData: FormData): Promise<ActionState> {
    "use server";
    const result = await deleteServiceGroupAction(previous, formData);
    if (result.ok) redirect("/admin/works/services");
    return result;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{group.services.length} service(s)</p>
        </div>
        <Link href="/admin/works/services" className={buttonVariants.secondary}>
          Back to Services
        </Link>
      </div>

      <div className={cardClass}>
        <h2 className="mb-3 text-sm font-semibold">Group</h2>
        <ActionForm action={saveGroup} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={group.id} />
          <Field label="Name" name="name" required defaultValue={group.name} className="min-w-56 flex-1" />
          <SubmitButton variant="secondary" pendingLabel="Saving…">
            Save name
          </SubmitButton>
        </ActionForm>

        {canPublish ? (
          <ActionForm action={removeGroup} className="mt-4 border-t border-border pt-4">
            <input type="hidden" name="id" value={group.id} />
            <ConfirmSubmitButton
              variant="danger"
              pendingLabel="Deleting…"
              confirmMessage={`Delete "${group.name}" and its ${group.services.length} service(s)? This cannot be undone.`}
            >
              Delete group
            </ConfirmSubmitButton>
          </ActionForm>
        ) : null}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Services</h2>

        {group.services.length === 0 ? (
          <p className="text-sm text-muted-foreground">No services in this group yet.</p>
        ) : (
          group.services.map((service, index) => (
            <div key={service.id} className={cardClass}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{service.key}</span>
                <div className="flex items-center gap-2">
                  <span className={badgeClass}>{service.published ? "Published" : "Draft"}</span>
                  {canPublish ? (
                    <div className="flex items-center gap-1">
                      {index === 0 ? (
                        <button type="button" disabled aria-hidden className={`${buttonVariants.small} opacity-30`}>
                          ↑
                        </button>
                      ) : (
                        <ActionForm action={reorderServiceAction} showMessage={false}>
                          <input type="hidden" name="id" value={service.id} />
                          <input type="hidden" name="direction" value="up" />
                          <SubmitButton variant="small" pendingLabel="…">
                            <span aria-hidden>↑</span>
                            <span className="sr-only">Move {service.name} up</span>
                          </SubmitButton>
                        </ActionForm>
                      )}
                      {index === group.services.length - 1 ? (
                        <button type="button" disabled aria-hidden className={`${buttonVariants.small} opacity-30`}>
                          ↓
                        </button>
                      ) : (
                        <ActionForm action={reorderServiceAction} showMessage={false}>
                          <input type="hidden" name="id" value={service.id} />
                          <input type="hidden" name="direction" value="down" />
                          <SubmitButton variant="small" pendingLabel="…">
                            <span aria-hidden>↓</span>
                            <span className="sr-only">Move {service.name} down</span>
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <ActionForm action={updateServiceAction} className="mt-3 grid grid-cols-1 gap-3 s768:grid-cols-2">
                <input type="hidden" name="id" value={service.id} />
                <Field label="Name" name="name" required defaultValue={service.name} />
                <Field label="Icon key" name="iconKey" required defaultValue={service.iconKey} />
                <Field
                  label="Description"
                  name="description"
                  multiline
                  defaultValue={service.description}
                  className="s768:col-span-2"
                />
                <SubmitButton variant="secondary" pendingLabel="Saving…">
                  Save service
                </SubmitButton>
              </ActionForm>

              {canPublish ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <ActionForm action={publishServiceAction}>
                    <input type="hidden" name="id" value={service.id} />
                    <input type="hidden" name="publish" value={service.published ? "false" : "true"} />
                    <SubmitButton variant="small" pendingLabel="Working…">
                      {service.published ? "Unpublish" : "Publish"}
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={deleteServiceAction}>
                    <input type="hidden" name="id" value={service.id} />
                    <ConfirmSubmitButton
                      variant="smallDanger"
                      pendingLabel="Deleting…"
                      confirmMessage={`Delete "${service.name}"? This cannot be undone.`}
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
        <h2 className="mb-3 text-sm font-semibold">Add a service</h2>
        <ActionForm action={createServiceAction} className="grid grid-cols-1 gap-3 s768:grid-cols-2">
          <input type="hidden" name="groupId" value={group.id} />
          <Field label="Key" name="key" required hint="Stable identifier, cannot be changed later." placeholder="e.g. WEB" />
          <Field label="Name" name="name" required />
          <Field label="Icon key" name="iconKey" required />
          <Field label="Description" name="description" multiline className="s768:col-span-2" />
          <SubmitButton pendingLabel="Adding…" className="s768:col-span-2">
            Add service
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
