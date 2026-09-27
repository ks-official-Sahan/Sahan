import HomeSection from "@/components/home/HomeSection";
import SectionHeading from "@/components/home/SectionHeading";
import type { PageContent } from "@/lib/cms/registry";
import { Globe, Layers, ShieldCheck, Smartphone } from "lucide-react";
import React from "react";

const icons = {
  layers: Layers,
  smartphone: Smartphone,
  shield: ShieldCheck,
  globe: Globe,
} as const;

// Benefits before features, and a list rather than a card grid: the heading
// stays pinned on wide screens while the four reasons scroll past it.

interface WhySectionProps {
  content: PageContent<"home">["why"];
}

const WhySection = ({ content: why }: WhySectionProps) => {

  return (
    <HomeSection id="why" labelledBy="why-title">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            id="why-title"
            title={why.title}
            description={why.subtitle}
          />
        </div>

        <ul className="divide-y divide-bBORDERFADE border-y border-bBORDERFADE">
          {why.points.map((point) => {
            const Icon = icons[point.icon as keyof typeof icons];

            return (
              <li
                key={point.title}
                className="reveal flex gap-5 py-7 s768:gap-6 s768:py-8"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bICON_FADE text-bICON"
                >
                  <Icon size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-semibold leading-snug s768:text-xl">
                    {point.title}
                  </h3>
                  <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed opacity-70 s768:text-base">
                    {point.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </HomeSection>
  );
};

export default WhySection;
