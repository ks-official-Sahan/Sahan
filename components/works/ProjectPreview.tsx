import { cn } from "@/lib/utils";
import type { Project, ProjectPlatform } from "@/types/project";
import { Globe, LayoutDashboard, Lock, Smartphone } from "lucide-react";
import React from "react";

export const platformLabels: Record<ProjectPlatform, string> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
  "web-admin": "Web Admin",
};

const platformIcons = {
  android: Smartphone,
  ios: Smartphone,
  web: Globe,
  "web-admin": LayoutDashboard,
} as const;

// A stable 0-100 number per project, so each tile lights up from a different
// corner but never changes between renders or between server and client.
const seed = (slug: string) =>
  [...slug].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 101, 7);

const monogram = (title: string) =>
  title
    .replace(/:.*$/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

// Most of these projects are private products with no public screenshots, so
// the preview is a designed tile instead of a stock image: a monogram, a glow
// that starts from a per-project corner, and the platforms it ships on.
const ProjectPreview = ({
  project,
  className,
}: {
  project: Project;
  className?: string;
}) => {
  const n = seed(project.slug);
  const glow = {
    background: `radial-gradient(60% 70% at ${20 + (n % 60)}% ${
      15 + ((n * 3) % 55)
    }%, color-mix(in srgb, var(--b-icon) 26%, transparent), transparent 70%)`,
  } as React.CSSProperties;

  return (
    <div
      className={cn(
        "relative aspect-[16/10] overflow-hidden bg-bFCARD",
        className
      )}
    >
      <div aria-hidden="true" className="absolute inset-0" style={glow} />
      <div aria-hidden="true" className="hero-grid absolute inset-0 opacity-70" />

      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center text-[length:clamp(3rem,2rem+4vw,5.5rem)] font-semibold tracking-[-0.04em] text-bICON"
      >
        {monogram(project.title)}
      </span>

      <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
        {[...new Set(project.platforms?.map((p) => platformIcons[p]))].map(
          (Icon, index) => (
            <span
              key={index}
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-bBORDERFADE bg-bFCARD"
            >
              <Icon size={15} />
            </span>
          )
        )}
      </div>

      <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-bBORDERFADE bg-bFCARD px-3 py-1 text-xs font-medium">
        {project.url ? (
          <>
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-bICON"
            />
            Live
          </>
        ) : (
          <>
            <Lock size={12} aria-hidden="true" />
            Private
          </>
        )}
      </span>
    </div>
  );
};

export default ProjectPreview;
