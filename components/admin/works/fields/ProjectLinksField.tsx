"use client";

import { useId } from "react";

import { useActionResult } from "@/components/admin/ui/ActionForm";
import { buttonVariants, fieldClass } from "@/components/admin/ui/styles";
import { toJsonField } from "@/lib/forms/array-fields";
import { cn } from "@/lib/utils";
import type { ProjectLink, ProjectLinkKind } from "@/types/project";

const KINDS: ProjectLinkKind[] = ["website", "webapp", "playstore", "appstore", "demo", "casestudy", "facebook"];

const EMPTY_LINK: ProjectLink = { kind: "website", url: "", label: "" };

// Add/remove/reorder editor for Project.links (Json: { kind, url, label? }[]
// — the first entry is the primary action). Mirrors state into one hidden
// JSON input; lib/actions/works.ts decodes it with decodeJsonFields and
// lib/collections/projects.ts's projectLinkSchema validates each row.
export default function ProjectLinksField({
  name,
  links,
  onChange,
}: {
  name: string;
  links: ProjectLink[];
  onChange: (links: ProjectLink[]) => void;
}) {
  const groupId = useId();
  const formError = useActionResult().fieldErrors?.[name];

  function update(index: number, patch: Partial<ProjectLink>) {
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  }

  function remove(index: number) {
    onChange(links.filter((_, i) => i !== index));
  }

  function move(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= links.length) return;
    const next = [...links];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div>
      <input type="hidden" name={name} value={toJsonField(links)} />
      <div className="flex items-center justify-between">
        <span id={`${groupId}-label`} className="text-sm font-medium">
          Links
        </span>
        <button type="button" onClick={() => onChange([...links, { ...EMPTY_LINK }])} className={buttonVariants.secondary}>
          Add link
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">The first link is the project&apos;s primary action button.</p>
      {formError ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {formError}
        </p>
      ) : null}

      {links.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No links added yet.</p>
      ) : (
        <ul aria-labelledby={`${groupId}-label`} className="mt-2 space-y-3">
          {links.map((link, index) => {
            const rowId = `${groupId}-${index}`;
            return (
              <li key={rowId} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label htmlFor={`${rowId}-kind`} className="text-xs font-medium text-muted-foreground">
                      Kind
                    </label>
                    <select
                      id={`${rowId}-kind`}
                      value={link.kind}
                      onChange={(event) => update(index, { kind: event.target.value as ProjectLinkKind })}
                      className={cn(fieldClass, "mt-1 w-36")}
                    >
                      {KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`${rowId}-url`} className="text-xs font-medium text-muted-foreground">
                      URL
                    </label>
                    <input
                      id={`${rowId}-url`}
                      type="url"
                      value={link.url}
                      onChange={(event) => update(index, { url: event.target.value })}
                      placeholder="https://…"
                      className={cn(fieldClass, "mt-1")}
                    />
                  </div>
                  <div className="w-40">
                    <label htmlFor={`${rowId}-label`} className="text-xs font-medium text-muted-foreground">
                      Label (optional)
                    </label>
                    <input
                      id={`${rowId}-label`}
                      value={link.label ?? ""}
                      onChange={(event) => update(index, { label: event.target.value })}
                      className={cn(fieldClass, "mt-1")}
                    />
                  </div>
                </div>
                <div className="mt-2 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => move(index, "up")}
                    disabled={index === 0}
                    aria-label={`Move link ${index + 1} up`}
                    className={buttonVariants.small}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, "down")}
                    disabled={index === links.length - 1}
                    aria-label={`Move link ${index + 1} down`}
                    className={buttonVariants.small}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Remove link ${index + 1}`}
                    className={buttonVariants.smallDanger}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
