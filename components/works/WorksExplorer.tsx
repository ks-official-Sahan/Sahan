"use client";

import { HomeContainer } from "@/components/home/HomeSection";
import ProjectCard from "@/components/works/ProjectCard";
import { platformLabels } from "@/components/works/ProjectPreview";
import { WorksContent } from "@/contents/works";
import { Projects } from "@/contents/projects";
import { cn } from "@/lib/utils";
import type { Project, ProjectPlatform } from "@/types/project";
import { useSearchParams } from "next/navigation";
import React, { useMemo, useState } from "react";

type TabId = (typeof WorksContent.tabs)[number]["id"];
type PlatformFilter = "all" | ProjectPlatform;

const matchers: Record<TabId, (project: Project) => boolean> = {
  all: () => true,
  products: (project) => project.category === "product",
  client: (project) => project.category !== "product",
};

// Featured first, then newest.
const sorted = [...Projects].sort(
  (a, b) =>
    Number(!!b.featured) - Number(!!a.featured) ||
    Number(b.year) - Number(a.year)
);

const WorksExplorer = () => {
  const searchParams = useSearchParams();
  const { tabs, results } = WorksContent;

  const [tab, setTab] = useState<TabId>(
    () => tabs.find((t) => t.param === searchParams.get("wt"))?.id ?? "all"
  );
  const [platform, setPlatform] = useState<PlatformFilter>("all");

  const inTab = useMemo(() => sorted.filter(matchers[tab]), [tab]);
  const platforms = useMemo(
    () =>
      [...new Set(inTab.flatMap((project) => project.platforms ?? []))] as ProjectPlatform[],
    [inTab]
  );
  const visible = useMemo(
    () =>
      platform === "all"
        ? inTab
        : inTab.filter((project) => project.platforms?.includes(platform)),
    [inTab, platform]
  );

  const selectTab = (id: TabId) => {
    setTab(id);
    setPlatform("all");
    // Keep the URL shareable without triggering a Next navigation.
    const param = tabs.find((t) => t.id === id)?.param ?? "all";
    const url = new URL(window.location.href);
    url.searchParams.set("wt", param);
    window.history.replaceState(null, "", url.toString());
  };

  // Arrow keys move between tabs, as in the ARIA tabs pattern.
  const onTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    selectTab(next.id);
    document.getElementById(`works-tab-${next.id}`)?.focus();
  };

  const first = visible[0];
  const featuredFirst = Boolean(first?.featured);

  return (
    <section
      id="projects"
      aria-labelledby="projects-title"
      className="w-full pt-2"
    >
      <HomeContainer>
        <h2 id="projects-title" className="sr-only">
          Projects
        </h2>

        {/* TABS + PLATFORM FILTER */}
        <div className="flex flex-col gap-4 s768:flex-row s768:items-center s768:justify-between">
          <div
            role="tablist"
            aria-label="Kind of work"
            className="no-scrollbar -mx-4 flex snap-x gap-1 overflow-x-auto px-4 s640:mx-0 s640:w-fit s640:overflow-visible s640:rounded-full s640:border s640:border-bBORDERFADE s640:bg-bCARD s640:p-1"
          >
            {tabs.map((item, index) => {
              const count = sorted.filter(matchers[item.id]).length;
              const selected = tab === item.id;

              return (
                <button
                  key={item.id}
                  id={`works-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="works-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectTab(item.id)}
                  onKeyDown={(event) => onTabKeyDown(event, index)}
                  className={cn(
                    "press min-h-11 shrink-0 snap-start whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-colors",
                    selected
                      ? "bg-bCHIPSELECTED text-white dark:text-black"
                      : "border border-bBORDERFADE bg-bCARD opacity-80 hover:opacity-100 s640:border-transparent s640:bg-transparent"
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "ml-2 tabular-nums",
                      selected ? "opacity-80" : "opacity-60"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            role="group"
            aria-label="Filter by platform"
            className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 s640:mx-0 s640:flex-wrap s640:overflow-visible s640:px-0"
          >
            {(["all", ...platforms] as PlatformFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={platform === value}
                onClick={() => setPlatform(value)}
                className={cn(
                  "press min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors",
                  platform === value
                    ? "border-transparent bg-bICON_FADE text-bICON"
                    : "border-bBORDERFADE bg-bCHIP opacity-80 hover:opacity-100"
                )}
              >
                {value === "all" ? "Any platform" : platformLabels[value]}
              </button>
            ))}
          </div>
        </div>

        {/* RESULTS */}
        <p aria-live="polite" className="sr-only">
          Showing {visible.length} {visible.length === 1 ? "project" : "projects"}
        </p>

        <div
          key={`${tab}-${platform}`}
          id="works-panel"
          role="tabpanel"
          aria-labelledby={`works-tab-${tab}`}
          className="swap-in mt-8"
        >
          {visible.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 s768:grid-cols-2 lg:grid-cols-3">
              {visible.map((project, index) => (
                <div
                  key={project.slug}
                  className={cn(
                    index === 0 &&
                      featuredFirst &&
                      "s768:col-span-2 lg:col-span-3"
                  )}
                >
                  <ProjectCard
                    project={project}
                    variant={
                      index === 0 && featuredFirst ? "featured" : "default"
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-sm opacity-70">
              {results.empty}
            </p>
          )}
        </div>
      </HomeContainer>
    </section>
  );
};

export default WorksExplorer;
