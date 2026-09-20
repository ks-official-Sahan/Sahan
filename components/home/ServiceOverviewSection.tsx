import ServiceCard from "@/components/about/ServiceCard";
import TitleBlock from "@/components/common/TitleBlock";
import WrapperBody from "@/components/wrappers/WrapperBody";
import { HomeContent } from "@/contents/home";
import { MyServices } from "@/contents/service";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import React from "react";

const featuredServices = MyServices.categories[0].services.slice(0, 3);

const ServiceOverviewSection = () => {
  const { service } = HomeContent;

  return (
    <section id="services" className="flex flex-col items-center pt-[100px]">
      <WrapperBody>
        <div className="flex items-end justify-between gap-6 sm:flex-col sm:items-start">
          <TitleBlock
            isBadge
            isSubtitle
            titleAs="h2"
            icon={<span aria-hidden="true">{service.icon}</span>}
            title={service.title}
            subtitle={service.subtitle}
            label={service.label}
            titleClass="text-[2rem] font-bold uppercase pt-[12px]"
          />

          <Link
            href="/about#services"
            className="inline-flex items-center gap-2 rounded-full border border-bBORDERFADE bg-bCARD px-6 py-3 text-[13px] font-semibold uppercase opacity-80 transition-opacity hover:opacity-100"
          >
            View all
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-5 pt-10 md:grid-cols-2 sm:grid-cols-1">
          {featuredServices.map((item) => (
            <ServiceCard key={item.id} service={item} />
          ))}
        </div>
      </WrapperBody>
    </section>
  );
};

export default ServiceOverviewSection;
