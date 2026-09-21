"use client";

import ProjectPreview, {
  linkIcons,
  linkLabels,
  platformLabels,
} from "@/components/works/ProjectPreview";
import { primaryLink } from "@/contents/projects";
import { cn } from "@/lib/utils";
import type { Project, ProjectLinkKind, ProjectStatus } from "@/types/project";
import { ArrowUpRight, X } from "lucide-react";
import Link from "next/link";
import React, { useRef } from "react";

const categoryLabels: Record<Project["category"], string> = {
  product: "Product",
  freelance: "Client project",
  contract: "Contract",
  internship: "Internship",
  internal: "Internal",
};

// The card's one primary action says what it opens.
const primaryLabels: Record<ProjectLinkKind, string> = {
  website: "Visit site",
  webapp: "Open web app",
  demo: "Try the demo",
  casestudy: "Read case study",
  playstore: "Google Play",
  appstore: "App Store",
  facebook: "Facebook page",
};

// Honest context for anything a visitor cannot open themselves.
const statusNotes: Partial<Record<ProjectStatus, string>> = {
  private:
    "This is private client work, so there is no public source. Happy to walk through it on a call.",
  upcoming:
    "This product has not reached the app stores yet. Ask me for a preview.",
  unpublished:
    "The apps are not published yet. Happy to demo it on a call.",
  offline:
    "This site is currently offline on the client's side, so there is no live link. Happy to talk through how it was built.",
};

const chip =
  "rounded-full border border-bBORDERFADE bg-bCHIP px-3 py-1 text-xs font-medium";

interface ProjectCardProps {
  project: Project;
  /** "featured" lays the preview beside the copy on wide screens. */
  variant?: "default" | "featured";
}

// Card first, dialog second: the card gives the scan (what, for whom, when),
// the native <dialog> gives the detail without leaving the page. Native means
// focus is trapped, Escape closes it and the page behind is inert for free.
const ProjectCard = ({ project, variant = "default" }: ProjectCardProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const featured = variant === "featured";
  const titleId = `${project.slug}-title`;
  const primary = primaryLink(project);
  const note = statusNotes[project.status];

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  return (
    <article
      className={cn(
        "lift group flex h-full flex-col overflow-hidden rounded-[20px] border border-bBORDERFADE bg-bCARD",
        featured && "lg:flex-row"
      )}
    >
      <ProjectPreview
        project={project}
        className={cn(featured && "lg:aspect-auto lg:w-[46%] lg:shrink-0")}
      />

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <h3
            id={titleId}
            className={cn(
              "font-semibold leading-snug",
              featured ? "text-2xl" : "text-lg"
            )}
          >
            {project.title}
          </h3>
          <p className="mt-1 text-sm opacity-70">{project.tagline}</p>
        </div>

        <p
          className={cn(
            "text-[15px] leading-relaxed opacity-80",
            !featured && "line-clamp-3"
          )}
        >
          {project.description}
        </p>

        {project.platforms && project.platforms.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Platforms">
            {project.platforms.map((platform) => (
              <li key={platform} className={chip}>
                {platformLabels[platform]}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
          <span className="text-xs opacity-70">
            {project.organization ?? project.role} · {project.year}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={open}
              aria-haspopup="dialog"
              className="press min-h-11 rounded-full border border-bBORDERFADE bg-bFCARD px-5 text-sm font-semibold"
            >
              Details
              <span className="sr-only"> for {project.title}</span>
            </button>
            {primary && (
              <Link
                href={primary.url}
                target="_blank"
                rel="noopener noreferrer"
                className="press arrow-nudge inline-flex min-h-11 items-center gap-1.5 rounded-full bg-bCHIPSELECTED px-5 text-sm font-semibold text-white dark:text-black"
              >
                {primaryLabels[primary.kind]}
                <ArrowUpRight
                  size={16}
                  aria-hidden="true"
                  className="arrow-nudge-icon"
                />
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${titleId}-dialog`}
        onClick={(event) => {
          // A click on the backdrop lands on the dialog element itself.
          if (event.target === event.currentTarget) close();
        }}
        className="project-dialog m-auto w-[min(92vw,640px)] rounded-[20px] border border-bBORDERFADE bg-bCARD p-0 text-foreground backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="swap-in flex max-h-[85svh] flex-col gap-6 overflow-y-auto p-6 s640:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id={`${titleId}-dialog`}
                className="text-2xl font-semibold leading-snug"
              >
                {project.title}
              </h2>
              <p className="mt-1 text-sm opacity-70">{project.tagline}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close details"
              className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-bBORDERFADE bg-bFCARD"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <ProjectPreview
            project={project}
            sizes="(min-width: 768px) 576px, 90vw"
            className="shrink-0 rounded-[14px] border border-bBORDERFADE"
          />

          <p className="text-base leading-relaxed opacity-80">
            {project.description}
          </p>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="opacity-70">My role</dt>
              <dd className="mt-1 font-semibold">{project.role}</dd>
            </div>
            <div>
              <dt className="opacity-70">Year</dt>
              <dd className="mt-1 font-semibold tabular-nums">{project.year}</dd>
            </div>
            <div>
              <dt className="opacity-70">Type</dt>
              <dd className="mt-1 font-semibold">
                {categoryLabels[project.category]}
              </dd>
            </div>
            {project.organization && (
              <div>
                <dt className="opacity-70">Team</dt>
                <dd className="mt-1 font-semibold">
                  {project.organizationUrl ? (
                    <Link
                      href={project.organizationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-bICON underline-offset-4 hover:underline"
                    >
                      {project.organization}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </Link>
                  ) : (
                    project.organization
                  )}
                </dd>
              </div>
            )}
            {project.platforms && project.platforms.length > 0 && (
              <div className="col-span-2">
                <dt className="opacity-70">Platforms</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {project.platforms.map((platform) => (
                    <span key={platform} className={chip}>
                      {platformLabels[platform]}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {project.tech && project.tech.length > 0 && (
              <div className="col-span-2">
                <dt className="opacity-70">Built with</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {project.tech.map((item) => (
                    <span key={item} className={chip}>
                      {item}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>

          {note && (
            <p className="rounded-[12px] border border-bBORDERFADE bg-bFCARD p-4 text-sm leading-relaxed opacity-80">
              {note}
            </p>
          )}

          {project.links && project.links.length > 0 && (
            <ul aria-label="Links" className="flex flex-wrap gap-3">
              {project.links.map((link, index) => {
                const Icon = linkIcons[link.kind];
                return (
                  <li key={link.url}>
                    <Link
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "press arrow-nudge inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-[15px] font-semibold",
                        index === 0
                          ? "bg-bCHIPSELECTED text-white dark:text-black"
                          : "border border-bBORDERFADE bg-bFCARD"
                      )}
                    >
                      <Icon size={17} aria-hidden="true" />
                      {link.label ?? linkLabels[link.kind]}
                      <ArrowUpRight
                        size={16}
                        aria-hidden="true"
                        className="arrow-nudge-icon"
                      />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="press inline-flex min-h-12 items-center rounded-full border border-bBORDERFADE bg-bFCARD px-6 text-[15px] font-semibold"
            >
              Discuss a similar project
            </Link>
          </div>
        </div>
      </dialog>
    </article>
  );
};

export default ProjectCard;
