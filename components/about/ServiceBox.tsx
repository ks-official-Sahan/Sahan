"use client";

import ServiceCard from "@/components/about/ServiceCard";
import TabChip from "@/components/about/TabChip";
import { MyServices } from "@/contents/service";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

const ServiceBox = () => {
  const { categories } = MyServices;
  const [selectedId, setSelectedId] = useState(categories[0].id);

  const services =
    categories.find((category) => category.id === selectedId)?.services ?? [];

  return (
    <div className="flex flex-col">
      {/* CATEGORY BAR: scrolls sideways on narrow screens */}
      <div
        role="tablist"
        aria-label="Service categories"
        className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 [scroll-padding-inline:1rem] s640:-mx-8 s640:px-8 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
      >
        {categories.map((category) => (
          <TabChip
            key={category.id}
            id={`service-tab-${category.id}`}
            controls="service-panel"
            title={category.name}
            selected={selectedId === category.id}
            onClick={() => setSelectedId(category.id)}
          />
        ))}
      </div>

      {/* SERVICES: keyed so switching tabs replays the entrance */}
      <div
        key={selectedId}
        role="tabpanel"
        id="service-panel"
        aria-labelledby={`service-tab-${selectedId}`}
        className="swap-in mt-6 grid grid-cols-1 gap-4 s768:grid-cols-2 s768:gap-5 lg:grid-cols-3"
      >
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>

      <div className="mt-12">
        <Link
          href="/contact"
          className="press arrow-nudge inline-flex min-h-12 items-center gap-2 rounded-full bg-bCHIPSELECTED px-7 text-[15px] font-semibold text-white dark:text-black"
        >
          Discuss a project
          <ArrowUpRight
            size={18}
            aria-hidden="true"
            className="arrow-nudge-icon"
          />
        </Link>
      </div>
    </div>
  );
};

export default ServiceBox;
