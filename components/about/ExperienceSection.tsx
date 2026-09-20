"use client";

import { Timeline } from "@/components/ui/timeline";
import { Experience } from "@/contents/experience";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import React from "react";

const typeLabels: Record<string, string> = {
  "full-time": "Full-time",
  contract: "Contract",
  "part-time": "Part-time",
  internship: "Internship",
  freelance: "Freelance",
};

const ExperienceSection = () => {
  const data = Experience.map((entry) => ({
    title: entry.period,
    content: (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">{entry.role}</span>
          <span className="opacity-70">@</span>
          {entry.companyUrl ? (
            <Link
              href={entry.companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-semibold text-[#3fae4c] hover:underline"
            >
              {entry.company}
              <ExternalLink size={12} />
            </Link>
          ) : (
            <span className="font-semibold">{entry.company}</span>
          )}
          <span className="rounded-full border px-2 py-0.5 text-[11px] opacity-70">
            {typeLabels[entry.type] ?? entry.type}
          </span>
          {entry.current && (
            <span className="rounded-full bg-[#91FF00] px-2 py-0.5 text-[11px] font-semibold text-black">
              Current
            </span>
          )}
        </div>
        {entry.location && (
          <div className="text-xs opacity-60">{entry.location}</div>
        )}
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm opacity-80">
          {entry.highlights.map((highlight, index) => (
            <li key={index}>{highlight}</li>
          ))}
        </ul>
      </div>
    ),
  }));

  return (
    <Timeline
      data={data}
      heading="Work Experience"
      description="Companies and engagements I've worked with, from full-time roles to contract and freelance projects."
    />
  );
};

export default ExperienceSection;
