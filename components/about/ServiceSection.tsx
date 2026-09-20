import ServiceBox from "@/components/about/ServiceBox";
import ChipMarquee from "@/components/common/ChipMarquee";
import HomeSection from "@/components/home/HomeSection";
import SectionHeading from "@/components/home/SectionHeading";
import { HomeContent } from "@/contents/home";
import { MyServices } from "@/contents/service";
import React from "react";

const allServices = MyServices.categories.flatMap(
  (category) => category.services
);

const ServiceSection = () => {
  const { service } = HomeContent;

  return (
    <HomeSection id="services" labelledBy="services-title">
      <SectionHeading
        id="services-title"
        title={service.title}
        description={service.subtitle}
      />

      {/* Everything on offer, drifting past; stops on hover. */}
      <ChipMarquee
        label="All services"
        duration={60}
        className="mt-8"
        minItems={6}
      >
        {allServices.map((item) => (
          <span
            key={item.id}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-bBORDERFADE bg-bCHIP py-1.5 pl-2.5 pr-4 text-sm"
          >
            <item.icon size={16} className="text-bICON" aria-hidden="true" />
            {item.name}
          </span>
        ))}
      </ChipMarquee>

      <div className="mt-10">
        <ServiceBox />
      </div>
    </HomeSection>
  );
};

export default ServiceSection;
