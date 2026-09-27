import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import ActionForm, { Field, SubmitButton } from "@/components/admin/ui/ActionForm";
import { buttonVariants, cardClass } from "@/components/admin/ui/styles";
import { createServiceGroupAction } from "@/lib/actions/works";
import type { ActionState } from "@/lib/actions/state";
import { requirePermission } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "New Service Group", robots: "noindex, nofollow, nocache" };

export default async function NewServiceGroupPage() {
  await requirePermission("editCollections");

  async function create(previous: ActionState, formData: FormData): Promise<ActionState> {
    "use server";
    const result = await createServiceGroupAction(previous, formData);
    if (result.ok) redirect("/admin/works/services");
    return result;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Service Group</h1>
          <p className="mt-1 text-sm text-muted-foreground">Add services to it after creating the group.</p>
        </div>
        <Link href="/admin/works/services" className={buttonVariants.secondary}>
          Back to Services
        </Link>
      </div>

      <ActionForm action={create} className={`${cardClass} space-y-4`}>
        <Field label="Name" name="name" required placeholder="e.g. Development" />
        <SubmitButton pendingLabel="Creating…">Create group</SubmitButton>
      </ActionForm>
    </div>
  );
}
