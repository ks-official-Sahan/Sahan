import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import ActionForm, { Field, SubmitButton } from "@/components/admin/ui/ActionForm";
import { buttonVariants, cardClass } from "@/components/admin/ui/styles";
import { createSkillGroupAction } from "@/lib/actions/works";
import type { ActionState } from "@/lib/actions/state";
import { requirePermission } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "New Skill Group", robots: "noindex, nofollow, nocache" };

export default async function NewSkillGroupPage() {
  await requirePermission("editCollections");

  async function create(previous: ActionState, formData: FormData): Promise<ActionState> {
    "use server";
    const result = await createSkillGroupAction(previous, formData);
    if (result.ok) redirect("/admin/works/skills");
    return result;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Skill Group</h1>
          <p className="mt-1 text-sm text-muted-foreground">Add skills to it after creating the group.</p>
        </div>
        <Link href="/admin/works/skills" className={buttonVariants.secondary}>
          Back to Skills
        </Link>
      </div>

      <ActionForm action={create} className={`${cardClass} space-y-4`}>
        <Field label="Key" name="key" required placeholder="e.g. SC1" hint="Stable identifier, cannot be changed later." />
        <Field label="Label" name="label" required placeholder="e.g. Languages" />
        <SubmitButton pendingLabel="Creating…">Create group</SubmitButton>
      </ActionForm>
    </div>
  );
}
