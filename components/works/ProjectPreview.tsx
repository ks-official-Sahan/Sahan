import { cn } from "@/lib/utils";
import type {
  Project,
  ProjectLinkKind,
  ProjectPlatform,
  ProjectStatus,
} from "@/types/project";
import {
  AppWindow,
  Clock,
  FileText,
  Globe,
  LayoutDashboard,
  Lock,
  MonitorPlay,
  Play,
  Rocket,
  Smartphone,
  Store,
  WifiOff,
} from "lucide-react";
import Image from "next/image";
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

export const linkLabels: Record<ProjectLinkKind, string> = {
  website: "Website",
  webapp: "Web app",
  playstore: "Google Play",
  appstore: "App Store",
  demo: "Live demo",
  casestudy: "Case study",
  facebook: "Facebook page",
};

export const linkIcons = {
  website: Globe,
  webapp: AppWindow,
  playstore: Play,
  appstore: Store,
  demo: MonitorPlay,
  casestudy: FileText,
  facebook: Globe,
} as const;

export const statusLabels: Record<ProjectStatus, string> = {
  live: "Live",
  demo: "Demo",
  upcoming: "Coming soon",
  unpublished: "Not yet published",
  offline: "Site offline",
  private: "Private",
};

const statusIcons: Partial<Record<ProjectStatus, typeof Lock>> = {
  upcoming: Rocket,
  unpublished: Clock,
  offline: WifiOff,
  private: Lock,
};

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

export const StatusBadge = ({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) => {
  const Icon = statusIcons[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-bBORDERFADE bg-bFCARD px-3 py-1 text-xs font-medium text-foreground",
        className
      )}
    >
      {Icon ? (
        <Icon size={12} aria-hidden="true" />
      ) : (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-bICON" />
      )}
      {statusLabels[status]}
    </span>
  );
};

// Real screenshots and mockups live in /public/works and win when present.
// Without one, the tile falls back to a designed placeholder: a monogram, a
// glow that starts from a per-project corner, and the platforms it ships on.
const ProjectPreview = ({
  project,
  className,
  sizes = "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw",
  priority = false,
}: {
  project: Project;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) => {
  const n = seed(project.slug);
  const glow = {
    background: `radial-gradient(60% 70% at ${20 + (n % 60)}% ${
      15 + ((n * 3) % 55)
    }%, color-mix(in srgb, var(--b-icon) 26%, transparent), transparent 70%)`,
  } as React.CSSProperties;
  const image = project.image;
  const contain = image?.fit === "contain";

  return (
    <div
      className={cn(
        "relative aspect-[16/10] overflow-hidden bg-bFCARD",
        className
      )}
      style={
        contain && image?.background
          ? { backgroundColor: image.background }
          : undefined
      }
    >
      {image ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn(
            "transition-transform duration-500 [transition-timing-function:var(--ease-out)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100",
            contain ? "object-contain p-2" : "object-cover"
          )}
          style={contain ? undefined : { objectPosition: image.position }}
        />
      ) : (
        <>
          <div aria-hidden="true" className="absolute inset-0" style={glow} />
          <div
            aria-hidden="true"
            className="hero-grid absolute inset-0 opacity-70"
          />

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
        </>
      )}

      <StatusBadge
        status={project.status}
        className="absolute right-3 top-3 shadow-sm"
      />
    </div>
  );
};

export default ProjectPreview;
