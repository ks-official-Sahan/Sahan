"use client";

import type { PageContent } from "@/lib/cms/registry";
import { GitHubStats } from "@/lib/github";
import { Github } from "lucide-react";
import Link from "next/link";
import React from "react";

interface GitHubStatsCardProps {
  stats: GitHubStats;
  content: PageContent<"about">["bento"];
}

const Stat = ({ label, value }: { label: string; value: number | null }) => (
  <div className="flex flex-col items-center">
    <div className="text-[22px] font-bold">
      {value !== null ? value.toLocaleString() : "—"}
    </div>
    <div className="text-[11px] uppercase tracking-wide opacity-60">
      {label}
    </div>
  </div>
);

const GitHubStatsCard = ({ stats, content }: GitHubStatsCardProps) => {
  return (
    <Link
      href={stats.profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full flex-col items-center gap-4"
    >
      <div className="flex items-center gap-2 text-[14px] font-semibold">
        <Github size={18} />
        <span>{content.githubLabel}</span>
      </div>

      <div className="flex w-full items-center justify-around">
        <Stat
          label={content.githubContributionsLabel}
          value={stats.contributionsLastYear}
        />
        <Stat label={content.githubReposLabel} value={stats.publicRepos} />
        <Stat label={content.githubFollowersLabel} value={stats.followers} />
      </div>

      <div className="text-[11px] opacity-70">
        {content.githubNote}
      </div>
    </Link>
  );
};

export default GitHubStatsCard;
