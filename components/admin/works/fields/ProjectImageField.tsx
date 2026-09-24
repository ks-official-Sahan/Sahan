"use client";

import { MediaPicker } from "@/components/admin/media/MediaPicker";
import { useActionResult } from "@/components/admin/ui/ActionForm";
import { buttonVariants, fieldClass } from "@/components/admin/ui/styles";
import { toJsonField } from "@/lib/forms/array-fields";
import { cn } from "@/lib/utils";
import type { ProjectImage } from "@/types/project";

// Project.image (Json?, nullable): { src, alt, fit?, background?, position?,
// mediaId? }. The hidden input is always rendered — even when `image` is
// null — so an explicit clear reaches the server as JSON "null" rather than
// being silently omitted (lib/actions/works.ts's createProjectAction /
// updateProjectAction rely on that to actually clear a stored image).
export default function ProjectImageField({
  name,
  image,
  onChange,
}: {
  name: string;
  image: ProjectImage | null;
  onChange: (image: ProjectImage | null) => void;
}) {
  function patch(fields: Partial<ProjectImage>) {
    onChange({ src: image?.src ?? "", alt: image?.alt ?? "", ...image, ...fields });
  }

  const formError = useActionResult().fieldErrors?.[name];

  return (
    <div>
      <input type="hidden" name={name} value={toJsonField(image)} />
      <span className="text-sm font-medium">Featured image</span>
      {formError ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="mt-1.5 flex min-h-[140px] items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/30">
        {image?.src ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview of a Cloudinary/LOCAL asset
          <img src={image.src} alt={image.alt || ""} className="h-full max-h-[200px] w-full object-cover" />
        ) : (
          <span className="text-sm text-muted-foreground">No image selected</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <MediaPicker
          kind="IMAGE"
          onSelect={(result) => patch({ src: result.src, mediaId: result.mediaId, alt: image?.alt || result.alt })}
        />
        <button type="button" onClick={() => onChange(null)} disabled={!image} className={buttonVariants.smallDanger}>
          Clear
        </button>
      </div>

      {image ? (
        <div className="mt-3 grid grid-cols-1 gap-3 s768:grid-cols-2">
          <div className="s768:col-span-2">
            <label htmlFor="project-image-alt" className="text-sm font-medium">
              Alt text
            </label>
            <input
              id="project-image-alt"
              value={image.alt}
              onChange={(event) => patch({ alt: event.target.value })}
              maxLength={200}
              required
              placeholder="Describe the image for screen readers and SEO"
              className={cn(fieldClass, "mt-1.5")}
            />
          </div>
          <div>
            <label htmlFor="project-image-fit" className="text-sm font-medium">
              Fit
            </label>
            <select
              id="project-image-fit"
              value={image.fit ?? "cover"}
              onChange={(event) => patch({ fit: event.target.value as ProjectImage["fit"] })}
              className={cn(fieldClass, "mt-1.5")}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain (phone mockups)</option>
            </select>
          </div>
          <div>
            <label htmlFor="project-image-position" className="text-sm font-medium">
              Position (optional)
            </label>
            <input
              id="project-image-position"
              value={image.position ?? ""}
              onChange={(event) => patch({ position: event.target.value || undefined })}
              placeholder="e.g. top center"
              className={cn(fieldClass, "mt-1.5")}
            />
          </div>
          {image.fit === "contain" ? (
            <div className="s768:col-span-2">
              <label htmlFor="project-image-background" className="text-sm font-medium">
                Background (optional)
              </label>
              <input
                id="project-image-background"
                value={image.background ?? ""}
                onChange={(event) => patch({ background: event.target.value || undefined })}
                placeholder="Matches the image's own backdrop, e.g. #0f172a"
                className={cn(fieldClass, "mt-1.5")}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
