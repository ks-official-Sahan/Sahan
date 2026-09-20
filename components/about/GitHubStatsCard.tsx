"use client";

import { GitHubStats } from "@/lib/github";
import { Github } from "lucide-react";
import Link from "next/link";
import React from "react";

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

const GitHubStatsCard = ({ stats }: { stats: GitHubStats }) => {
  return (
    <Link
      href={stats.profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full flex-col items-center gap-4"
    >
      <div className="flex items-center gap-2 text-[14px] font-semibold">
        <Github size={18} />
        <span>GitHub Activity</span>
      </div>

      <div className="flex w-full items-center justify-around">
        <Stat
          label="Contributions"
          value={stats.contributionsLastYear}
        />
        <Stat label="Public Repos" value={stats.publicRepos} />
        <Stat label="Followers" value={stats.followers} />
      </div>

      <div className="text-[11px] opacity-50">
        Contributions counted over the last year
      </div>
    </Link>
  );
};

export default GitHubStatsCard;
