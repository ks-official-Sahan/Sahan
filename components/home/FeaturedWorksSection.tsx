import TitleBlock from "@/components/common/TitleBlock";
import ProjectCard from "@/components/works/ProjectCard";
import WrapperBody from "@/components/wrappers/WrapperBody";
import { HomeContent } from "@/contents/home";
import { Projects } from "@/contents/projects";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import React from "react";

const featuredProjects = Projects.filter((project) => project.featured);

const FeaturedWorksSection = () => {
  const { works } = HomeContent;

  return (
    <section id="works" className="flex flex-col items-center pt-[100px]">
      <WrapperBody>
        <div className="grid grid-cols-3 gap-5 md:grid-cols-2 sm:grid-cols-1">
          <div className="flex flex-col justify-between gap-8 md:col-span-2 sm:col-span-1">
            <TitleBlock
              isBadge
              isSubtitle
              titleAs="h2"
              icon={<span aria-hidden="true">{works.icon}</span>}
              title={works.title}
              subtitle={works.subtitle}
              label={works.label}
              titleClass="text-[2rem] font-bold uppercase pt-[12px]"
            />

            <Link
              href="/works"
              className="flex w-fit items-center gap-4 rounded-full border border-bBORDERFADE bg-bFCARD py-3 pl-8 pr-4 text-[13px] font-semibold uppercase opacity-80 transition-opacity hover:opacity-100"
            >
              {works.buttonTitle}
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-bCHIP"
              >
                <ArrowUpRight size={22} />
              </span>
            </Link>
          </div>

          {featuredProjects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
      </WrapperBody>
    </section>
  );
};

export default FeaturedWorksSection;
