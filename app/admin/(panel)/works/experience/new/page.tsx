import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import ExperienceForm from "@/components/admin/works/ExperienceForm";
import { buttonVariants } from "@/components/admin/ui/styles";
import { createExperienceAction } from "@/lib/actions/works";
import type { ActionState } from "@/lib/actions/state";
import { requirePermission } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "New Experience Entry", robots: "noindex, nofollow, nocache" };

export default async function NewExperiencePage() {
  await requirePermission("editCollections");

  async function create(previous: ActionState, formData: FormData): Promise<ActionState> {
    "use server";
    const result = await createExperienceAction(previous, formData);
    if (result.ok) redirect("/admin/works/experience");
    return result;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Experience Entry</h1>
          <p className="mt-1 text-sm text-muted-foreground">Add a work history entry. It is saved unpublished.</p>
        </div>
        <Link href="/admin/works/experience" className={buttonVariants.secondary}>
          Back to Experience
        </Link>
      </div>

      <ExperienceForm action={create} />
    </div>
  );
}
