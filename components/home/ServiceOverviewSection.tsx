import HomeSection from "@/components/home/HomeSection";
import SectionHeading from "@/components/home/SectionHeading";
import ServiceCard from "@/components/about/ServiceCard";
import { HomeContent } from "@/contents/home";
import { MyServices } from "@/contents/service";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import React from "react";

const featuredServices = MyServices.categories[0].services.slice(0, 3);

const ServiceOverviewSection = () => {
  const { home } = HomeContent;

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

      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {featuredServices.map((item) => (
          <div key={item.id} className="reveal">
            <ServiceCard service={item} />
          </div>
        ))}
      </div>
    </HomeSection>
  );
};

export default ServiceOverviewSection;
