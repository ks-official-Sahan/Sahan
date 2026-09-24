"use client";

import { useActionResult } from "@/components/admin/ui/ActionForm";
import { toJsonField } from "@/lib/forms/array-fields";
import type { ProjectPlatform } from "@/types/project";

const OPTIONS: { value: ProjectPlatform; label: string }[] = [
  { value: "web", label: "Web" },
  { value: "web-admin", label: "Web (admin)" },
  { value: "android", label: "Android" },
  { value: "ios", label: "iOS" },
];

// Checkbox group for Project.platforms (String[]). FormData keeps only the
// last value per name, so checked platforms are tracked in state and mirrored
// into one hidden JSON input — lib/actions/works.ts decodes it with
// decodeJsonFields.
export default function PlatformsField({
  name,
  value,
  onChange,
}: {
  name: string;
  value: ProjectPlatform[];
  onChange: (value: ProjectPlatform[]) => void;
}) {
  function toggle(platform: ProjectPlatform, checked: boolean) {
    onChange(checked ? [...value, platform] : value.filter((item) => item !== platform));
  }

  const formError = useActionResult().fieldErrors?.[name];

  return (
    <fieldset>
      <input type="hidden" name={name} value={toJsonField(value)} />
      <legend className="text-sm font-medium">Platforms</legend>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
        {OPTIONS.map((option) => {
          const id = `platform-${option.value}`;
          return (
            <label key={option.value} htmlFor={id} className="flex items-center gap-2 text-sm">
              <input
                id={id}
                type="checkbox"
                checked={value.includes(option.value)}
                onChange={(event) => toggle(option.value, event.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {option.label}
            </label>
          );
        })}
      </div>
      {formError ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {formError}
        </p>
      ) : null}
    </fieldset>
  );
}
