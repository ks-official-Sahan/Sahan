import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import ProjectForm from "@/components/admin/works/ProjectForm";
import { buttonVariants } from "@/components/admin/ui/styles";
import { createProjectAction } from "@/lib/actions/works";
import type { ActionState } from "@/lib/actions/state";
import { requirePermission } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "New Project", robots: "noindex, nofollow, nocache" };

export default async function NewProjectPage() {
  await requirePermission("editCollections");

  async function create(previous: ActionState, formData: FormData): Promise<ActionState> {
    "use server";
    const result = await createProjectAction(previous, formData);
    if (result.ok) redirect("/admin/works/projects");
    return result;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Project</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create a portfolio project. It is saved unpublished.</p>
        </div>
        <Link href="/admin/works/projects" className={buttonVariants.secondary}>
          Back to Projects
        </Link>
      </div>

      <ProjectForm action={create} />
    </div>
  );
}
