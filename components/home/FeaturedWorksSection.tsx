import HomeSection from "@/components/home/HomeSection";
import SectionHeading from "@/components/home/SectionHeading";
import ProjectCard from "@/components/works/ProjectCard";
import { HomeContent } from "@/contents/home";
import { Projects } from "@/contents/projects";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import React from "react";

const featuredProjects = Projects.filter((project) => project.featured);

const FeaturedWorksSection = () => {
  const { home, works } = HomeContent;

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
            {works.buttonTitle}
            <ArrowUpRight
              size={16}
              aria-hidden="true"
              className="arrow-nudge-icon"
            />
          </Link>
        }
      />

      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-2">
        {featuredProjects.map((project) => (
          <div key={project.slug} className="reveal">
            <ProjectCard project={project} />
          </div>
        ))}
      </div>
    </HomeSection>
  );
};

export default FeaturedWorksSection;
