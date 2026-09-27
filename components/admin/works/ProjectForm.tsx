"use client";

import { useState, type ReactNode } from "react";

import ActionForm, { Field, SubmitButton } from "@/components/admin/ui/ActionForm";
import { cardClass, fieldClass } from "@/components/admin/ui/styles";
import type { ActionState } from "@/lib/actions/state";
import { cn } from "@/lib/utils";
import type { Project, ProjectCategory, ProjectImage, ProjectLink, ProjectPlatform, ProjectStatus } from "@/types/project";

import PlatformsField from "./fields/PlatformsField";
import ProjectImageField from "./fields/ProjectImageField";
import ProjectLinksField from "./fields/ProjectLinksField";
import TagListField from "./fields/TagListField";

// Create and edit share this component, matching BlogEditorForm's pattern.
// Field names line up 1:1 with lib/actions/works.ts's createProjectSchema.

export interface EditableProject extends Omit<Project, "platforms" | "tech" | "links" | "image"> {
  id?: string;
  platforms: ProjectPlatform[];
  tech: string[];
  links: ProjectLink[];
  image: ProjectImage | null;
}

const EMPTY_PROJECT: EditableProject = {
  slug: "",
  title: "",
  tagline: "",
  description: "",
  role: "",
  organization: "",
  organizationUrl: "",
  category: "product",
  status: "unpublished",
  platforms: [],
  tech: [],
  year: String(new Date().getFullYear()),
  image: null,
  links: [],
};

const CATEGORIES: ProjectCategory[] = ["product", "freelance", "contract", "internship", "internal"];
const STATUSES: ProjectStatus[] = ["live", "demo", "upcoming", "unpublished", "offline", "private"];

export default function ProjectForm({
  action,
  project,
  sidePanel,
}: {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  project?: EditableProject;
  /** Edit page only: publish/feature/delete controls, rendered in the right column. */
  sidePanel?: ReactNode;
}) {
  const initial = project ?? EMPTY_PROJECT;
  const isEdit = Boolean(project?.id);

  const [platforms, setPlatforms] = useState<ProjectPlatform[]>(initial.platforms);
  const [tech, setTech] = useState<string[]>(initial.tech);
  const [links, setLinks] = useState<ProjectLink[]>(initial.links);
  const [image, setImage] = useState<ProjectImage | null>(initial.image);

  return (
    <ActionForm action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {project?.id ? <input type="hidden" name="id" defaultValue={project.id} /> : null}

      <div className="space-y-6">
        <div className={cn(cardClass, "space-y-4")}>
          <div className="grid grid-cols-1 gap-4 s768:grid-cols-2">
            <Field label="Title" name="title" required defaultValue={initial.title} />
            {isEdit ? (
              <div>
                <span className="text-sm font-medium">Slug</span>
                <input value={initial.slug} disabled className={cn(fieldClass, "mt-1.5")} />
                <p className="mt-1 text-xs text-muted-foreground">Slugs cannot be changed after creation.</p>
              </div>
            ) : (
              <Field
                label="Slug"
                name="slug"
                required
                defaultValue={initial.slug}
                hint="Used in the project URL. Cannot be changed later."
                autoComplete="off"
              />
            )}
          </div>

          <Field label="Tagline" name="tagline" required defaultValue={initial.tagline} />
          <Field label="Description" name="description" required multiline defaultValue={initial.description} />

          <div className="grid grid-cols-1 gap-4 s768:grid-cols-2">
            <Field label="Role" name="role" required defaultValue={initial.role} />
            <Field label="Year" name="year" required defaultValue={initial.year} />
            <Field label="Organization (optional)" name="organization" defaultValue={initial.organization ?? ""} />
            <Field
              label="Organization URL (optional)"
              name="organizationUrl"
              type="url"
              defaultValue={initial.organizationUrl ?? ""}
              placeholder="https://…"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 s768:grid-cols-2">
            <div>
              <label htmlFor="project-category" className="text-sm font-medium">
                Category
              </label>
              <select id="project-category" name="category" defaultValue={initial.category} className={cn(fieldClass, "mt-1.5")}>
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="project-status" className="text-sm font-medium">
                Status
              </label>
              <select id="project-status" name="status" defaultValue={initial.status} className={cn(fieldClass, "mt-1.5")}>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <PlatformsField name="platforms" value={platforms} onChange={setPlatforms} />
          <TagListField
            label="Tech stack"
            name="tech"
            items={tech}
            onChange={setTech}
            placeholder="e.g. Next.js — press Enter to add"
          />
        </div>

        <div className={cardClass}>
          <ProjectLinksField name="links" links={links} onChange={setLinks} />
        </div>
      </div>

      <div className="space-y-6">
        <div className={cardClass}>
          <ProjectImageField name="image" image={image} onChange={setImage} />
        </div>

        {sidePanel}

        <div className={cardClass}>
          <SubmitButton pendingLabel="Saving…" className="w-full">
            {isEdit ? "Save changes" : "Create project"}
          </SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
