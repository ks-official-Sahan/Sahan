"use client";

import ServiceCard from "@/components/about/ServiceCard";
import TabChip from "@/components/about/TabChip";
import { MyServices } from "@/contents/service";
import Link from "next/link";
import React, { useState } from "react";

const ServiceBox = () => {
  const { categories } = MyServices;
  const [selectedId, setSelectedId] = useState(categories[0].id);

  const services =
    categories.find((category) => category.id === selectedId)?.services ?? [];

  return (
    <div className="flex flex-col">
      {/* CATEGORY BAR */}
      <div
        role="tablist"
        aria-label="Service categories"
        className="flex flex-wrap gap-3"
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

      {/* SEPARATOR */}
      <div className="mt-6 h-px w-full bg-border" />

      {/* SERVICES */}
      <div
        role="tabpanel"
        id="service-panel"
        aria-labelledby={`service-tab-${selectedId}`}
        className="grid grid-cols-3 gap-5 pt-8 md:grid-cols-2 sm:grid-cols-1"
      >
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>

      {/* DISCUSS */}
      <div className="mt-14 flex items-center gap-5">
        <div className="h-px flex-1 bg-border sm:hidden" />
        <Link
          href="/contact"
          className="rounded-[12px] bg-bFRAME px-8 py-3 text-[14px] font-medium transition-opacity hover:opacity-80"
        >
          Discuss a project
        </Link>
        <div className="h-px flex-1 bg-border sm:hidden" />
      </div>
    </div>
  );
};

export default ServiceBox;
