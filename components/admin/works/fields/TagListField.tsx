"use client";

import { useId, useState, type KeyboardEvent } from "react";

import { useActionResult } from "@/components/admin/ui/ActionForm";
import { buttonVariants, fieldClass } from "@/components/admin/ui/styles";
import { toJsonField } from "@/lib/forms/array-fields";
import { cn } from "@/lib/utils";

// Accessible add/remove editor for a plain string[] field (Project.tech,
// Experience.highlights). Holds its own list in React state and mirrors it
// into one hidden JSON input, since FormData collapses repeated same-named
// fields — lib/actions/works.ts decodes it with decodeJsonFields.

export default function TagListField({
  label,
  name,
  items,
  onChange,
  placeholder,
  hint,
  multiline = false,
}: {
  label: string;
  name: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  hint?: string;
  /** Use a textarea for longer entries (e.g. highlight sentences) instead of a single-line input. */
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const listId = `${inputId}-items`;
  const formError = useActionResult().fieldErrors?.[name];

  function commit() {
    const value = draft.trim();
    if (!value) return;
    onChange([...items, value]);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commit();
    }
  }

  function removeAt(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div>
      <input type="hidden" name={name} value={toJsonField(items)} />
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <div className="mt-1.5 flex gap-2">
        {multiline ? (
          <textarea
            id={inputId}
            className={cn(fieldClass, "min-h-10 py-2")}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-describedby={hint ? `${inputId}-hint` : undefined}
          />
        ) : (
          <input
            id={inputId}
            className={fieldClass}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-describedby={hint ? `${inputId}-hint` : undefined}
          />
        )}
        <button type="button" onClick={commit} disabled={!draft.trim()} className={buttonVariants.secondary}>
          Add
        </button>
      </div>
      {hint ? (
        <p id={`${inputId}-hint`} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {formError ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {formError}
        </p>
      ) : null}
      {items.length > 0 ? (
        <ul id={listId} className="mt-2 flex flex-wrap gap-2">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
            >
              <span className="truncate">{item}</span>
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label={`Remove ${item}`}
                className="shrink-0 rounded-full text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">None added yet.</p>
      )}
    </div>
  );
}
