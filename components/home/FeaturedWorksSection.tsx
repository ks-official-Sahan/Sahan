import HomeSection from "@/components/home/HomeSection";
import SectionHeading from "@/components/home/SectionHeading";
import SnapRow from "@/components/home/SnapRow";
import ProjectCard from "@/components/works/ProjectCard";
import type { PageContent } from "@/lib/cms/registry";
import type { Project } from "@/types/project";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import React from "react";

interface FeaturedWorksSectionProps {
  content: PageContent<"home">["home"];
  projects: Project[];
}

const FeaturedWorksSection = ({ content: home, projects }: FeaturedWorksSectionProps) => {
  const featuredProjects = projects.filter((project) => project.featured);

  return (
    <HomeSection id="works" labelledBy="works-title">
      <SectionHeading
        id="works-title"
        title={home.works.title}
        description={home.works.subtitle}
        action={
          <Link
            href="/works"
            className="press arrow-nudge inline-flex min-h-11 items-center gap-2 rounded-full border border-bBORDERFADE bg-bCARD px-5 text-sm font-semibold"
          >
            {home.works.buttonTitle}
            <ArrowUpRight
              size={16}
              aria-hidden="true"
              className="arrow-nudge-icon"
            />
          </Link>
        }
      />

      <div className="mt-10">
        <SnapRow
          label="Featured projects"
          gridClassName="s768:grid-cols-2 s768:gap-5 lg:grid-cols-[1.35fr_1fr]"
        >
          {featuredProjects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </SnapRow>
      </div>
    </HomeSection>
  );
};

export default FeaturedWorksSection;
