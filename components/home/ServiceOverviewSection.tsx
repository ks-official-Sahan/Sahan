import ServiceCard from "@/components/about/ServiceCard";
import HomeSection from "@/components/home/HomeSection";
import SectionHeading from "@/components/home/SectionHeading";
import SnapRow from "@/components/home/SnapRow";
import type { PageContent } from "@/lib/cms/registry";
import { MyServices } from "@/contents/service";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import React from "react";

const featuredServices = MyServices.categories[0].services.slice(0, 3);

interface ServiceOverviewSectionProps {
  content: PageContent<"home">["home"];
}

const ServiceOverviewSection = ({ content: home }: ServiceOverviewSectionProps) => {

  return (
    <HomeSection id="services" labelledBy="services-title">
      <SectionHeading
        id="services-title"
        title={home.services.title}
        description={home.services.subtitle}
        action={
          <Link
            href="/about#services"
            className="press arrow-nudge inline-flex min-h-11 items-center gap-2 rounded-full border border-bBORDERFADE bg-bCARD px-5 text-sm font-semibold"
          >
            View all services
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
          label="Services"
          gridClassName="s768:grid-cols-2 s768:gap-5 s768:[&>div:last-child:nth-child(odd)]:col-span-2 lg:grid-cols-3 lg:[&>div:last-child:nth-child(odd)]:col-span-1"
        >
          {featuredServices.map((item) => (
            <ServiceCard key={item.id} service={item} />
          ))}
        </SnapRow>
      </div>
    </HomeSection>
  );
};

export default ServiceOverviewSection;
