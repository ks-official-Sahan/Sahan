"use client";

import { Projects, ProjectFilters } from "@/contents/projects";
import ProjectCard from "@/components/works/ProjectCard";
import { cn } from "@/lib/utils";
import React, { useMemo, useState } from "react";

const ProjectGrid = () => {
  const [filter, setFilter] = useState<(typeof ProjectFilters)[number]["value"]>(
    "all"
  );

  const filtered = useMemo(
    () =>
      filter === "all"
        ? Projects
        : Projects.filter((project) => project.category === filter),
    [filter]
  );

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {ProjectFilters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={cn(
              "rounded-full border px-[20px] py-[6px] text-[13px] font-medium transition-colors",
              filter === item.value
                ? "bg-[#91FF00] text-black border-[#91FF00]"
                : "opacity-70 hover:opacity-100"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-sm opacity-60">
          Nothing to show in this category yet.
        </div>
      )}
    </div>
  );
};

export default ProjectGrid;
