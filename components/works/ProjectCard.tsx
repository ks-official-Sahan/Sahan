"use client";

import { Project } from "@/types/project";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowUpRight, Lock } from "lucide-react";
import Link from "next/link";
import React from "react";

const platformLabels: Record<string, string> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
  "web-admin": "Web Admin",
};

const ProjectCard = ({ project }: { project: Project }) => {
  const cardClassName = cn(
    "group flex h-full flex-col gap-4 rounded-[20px] border bg-[#f7f7f7] dark:bg-[#141414] p-6 transition-colors",
    project.url && "hover:border-[#91FF00]/60"
  );

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[18px] font-semibold">{project.title}</div>
          <div className="text-[13px] text-secondaryT">{project.tagline}</div>
        </div>
        {project.url ? (
          <ArrowUpRight
            size={18}
            className="mt-1 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
          />
        ) : project.private ? (
          <span
            title="Private / proprietary project"
            className="mt-1 shrink-0 opacity-50"
          >
            <Lock size={16} />
          </span>
        ) : null}
      </div>

      <p className="text-[13px] leading-relaxed opacity-75">
        {project.description}
      </p>

      {project.platforms && project.platforms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {project.platforms.map((platform) => (
            <span
              key={platform}
              className="rounded-full border px-[10px] py-[3px] text-[11px] font-medium opacity-70"
            >
              {platformLabels[platform] ?? platform}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-2 text-[12px] opacity-60">
        <span>{project.organization ?? project.role}</span>
        <span>{project.year}</span>
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      {project.url ? (
        <Link
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cardClassName}
        >
          {content}
        </Link>
      ) : (
        <div className={cardClassName}>{content}</div>
      )}
    </motion.div>
  );
};

export default ProjectCard;
