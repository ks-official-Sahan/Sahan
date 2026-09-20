import HomeSection from "@/components/home/HomeSection";
import SectionHeading from "@/components/home/SectionHeading";
import { HomeContent } from "@/contents/home";
import React from "react";

// A real sequence, so the numbers carry information (order matters here).
const ProcessSection = () => {
  const { process, home } = HomeContent;

  return (
    <HomeSection id="process" labelledBy="process-title">
      <SectionHeading
        id="process-title"
        title={home.process.title}
        description={home.process.subtitle}
      />

      <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {process.map((step, index) => (
          <li
            key={step.title}
            className="reveal flex flex-col gap-3 rounded-[12px] border border-bBORDERFADE bg-bCARD p-6"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-bICON_FADE text-sm font-semibold tabular-nums text-bICON"
            >
              {index + 1}
            </span>
            <h3 className="text-lg font-semibold leading-snug">{step.title}</h3>
            <p className="text-[15px] leading-relaxed opacity-70">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </HomeSection>
  );
};

export default ProcessSection;
