import HomeSection from "@/components/home/HomeSection";
import SectionHeading from "@/components/home/SectionHeading";
import { Experience } from "@/contents/experience";
import type { PageContent } from "@/lib/cms/registry";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import React from "react";

interface ExperienceSectionProps {
  content: PageContent<"about">;
}

const chip =
  "rounded-full border border-bBORDERFADE bg-bCHIP px-2.5 py-0.5 text-xs";

// A plain ledger: period on the left, the work on the right. Read top to
// bottom it is the career; nothing here is scroll-jacked or animated by JS.
const ExperienceSection = ({ content }: ExperienceSectionProps) => {
  const typeLabels: Record<string, string> = {
    "full-time": content.experience.typeLabelFulltime,
    contract: content.experience.typeLabelContract,
    "part-time": content.experience.typeLabelParttime,
    internship: content.experience.typeLabelInternship,
    freelance: content.experience.typeLabelFreelance,
  };

  return (
  <HomeSection id="experience" labelledBy="experience-title">
    <SectionHeading
      id="experience-title"
      title={content.experience.title}
      description={content.experience.description}
    />

    <ol className="mt-10 divide-y divide-bBORDERFADE border-y border-bBORDERFADE">
      {Experience.map((entry) => (
        <li
          key={`${entry.company}-${entry.period}`}
          className="reveal grid grid-cols-1 gap-3 py-8 lg:grid-cols-[200px_1fr] lg:gap-10"
        >
          <div className="text-sm font-semibold tabular-nums opacity-70 lg:text-base">
            {entry.period}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h3 className="text-lg font-semibold">{entry.role}</h3>
              {entry.companyUrl ? (
                <Link
                  href={entry.companyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-bICON underline-offset-4 hover:underline"
                >
                  {entry.company}
                  <ExternalLink size={13} aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </Link>
              ) : (
                <span className="font-semibold opacity-80">{entry.company}</span>
              )}
              <span className={chip}>
                {typeLabels[entry.type] ?? entry.type}
              </span>
              {entry.current && (
                <span className="rounded-full bg-bCHIPSELECTED px-2.5 py-0.5 text-xs font-semibold text-white dark:text-black">
                  {content.experience.currentBadge}
                </span>
              )}
            </div>

            {entry.location && (
              <div className="text-sm opacity-70">{entry.location}</div>
            )}

            <ul className="max-w-[70ch] list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed opacity-80">
              {entry.highlights.map((highlight, index) => (
                <li key={index}>{highlight}</li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ol>
  </HomeSection>
);
};

export default ExperienceSection;
