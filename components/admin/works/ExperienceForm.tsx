"use client";

import { useState, type ReactNode } from "react";

import ActionForm, { Field, SubmitButton } from "@/components/admin/ui/ActionForm";
import { cardClass, fieldClass } from "@/components/admin/ui/styles";
import type { ActionState } from "@/lib/actions/state";
import { cn } from "@/lib/utils";
import type { EmploymentType } from "@/types/experience";

import TagListField from "./fields/TagListField";

// Create and edit share this component. Field names line up 1:1 with
// lib/actions/works.ts's createExperienceSchema.

export interface EditableExperience {
  id?: string;
  company: string;
  companyUrl: string;
  role: string;
  period: string;
  type: EmploymentType;
  location: string;
  highlights: string[];
  current: boolean;
}

const EMPTY_EXPERIENCE: EditableExperience = {
  company: "",
  companyUrl: "",
  role: "",
  period: "",
  type: "full-time",
  location: "",
  highlights: [],
  current: false,
};

const TYPES: EmploymentType[] = ["full-time", "contract", "part-time", "internship", "freelance"];

export default function ExperienceForm({
  action,
  experience,
  sidePanel,
}: {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  experience?: EditableExperience;
  /** Edit page only: publish/delete controls, rendered in the right column. */
  sidePanel?: ReactNode;
}) {
  const initial = experience ?? EMPTY_EXPERIENCE;
  const isEdit = Boolean(experience?.id);

  const [highlights, setHighlights] = useState<string[]>(initial.highlights);
  const [current, setCurrent] = useState(initial.current);

  return (
    <ActionForm action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      {experience?.id ? <input type="hidden" name="id" defaultValue={experience.id} /> : null}

      <div className="space-y-6">
        <div className={cn(cardClass, "space-y-4")}>
          <div className="grid grid-cols-1 gap-4 s768:grid-cols-2">
            <Field label="Company" name="company" required defaultValue={initial.company} />
            <Field
              label="Company URL (optional)"
              name="companyUrl"
              type="url"
              defaultValue={initial.companyUrl}
              placeholder="https://…"
            />
            <Field label="Role" name="role" required defaultValue={initial.role} />
            <Field label="Period" name="period" required defaultValue={initial.period} placeholder="e.g. 2023 — Present" />
            <Field label="Location (optional)" name="location" defaultValue={initial.location} />
            <div>
              <label htmlFor="experience-type" className="text-sm font-medium">
                Employment type
              </label>
              <select id="experience-type" name="type" defaultValue={initial.type} className={cn(fieldClass, "mt-1.5")}>
                {TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="current"
              value="true"
              checked={current}
              onChange={(event) => setCurrent(event.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            This is the current role
          </label>

          <TagListField
            label="Highlights"
            name="highlights"
            items={highlights}
            onChange={setHighlights}
            placeholder="A highlight sentence — press Enter to add"
            multiline
          />
        </div>
      </div>

      <div className="space-y-6">
        {sidePanel}
        <div className={cardClass}>
          <SubmitButton pendingLabel="Saving…" className="w-full">
            {isEdit ? "Save changes" : "Create experience entry"}
          </SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
