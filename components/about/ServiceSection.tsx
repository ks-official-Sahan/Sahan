import ServiceBox from "@/components/about/ServiceBox";
import TitleBlock from "@/components/common/TitleBlock";
import WrapperBody from "@/components/wrappers/WrapperBody";
import { HomeContent } from "@/contents/home";
import React from "react";

const ServiceSection = () => {
  const { service } = HomeContent;

  return (
    <section id="services" className="w-full pt-[80px]">
      <WrapperBody>
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

        <div className="pt-[50px]">
          <ServiceBox />
        </div>
      </WrapperBody>
    </section>
  );
};

export default ServiceSection;
