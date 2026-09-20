import Particals from "@/components/custom/Particals";
import { BorderBeam } from "@/components/ui/border-beam";
import WrapperBody from "@/components/wrappers/WrapperBody";
import { Site } from "@/config/site";
import { HomeContent } from "@/contents/home";
import { stagger } from "@/components/home/HomeSection";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

// Hero rules: one h1, one line of support, two actions, one status chip. The
// availability chip is the only decoration that moves forever, and it is tiny.
const HomeHero = () => {
  const { hero } = HomeContent;

  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="relative flex w-full flex-col items-center overflow-hidden bg-gradient-to-b pb-[clamp(3rem,6vw,5rem)] pt-[clamp(7rem,14vw,10rem)] dark:from-black dark:to-[#0d0d0d]"
    >
      <Particals quantity={120} size={0.5} />

      <WrapperBody>
        <div className="relative grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div className="flex flex-col items-start gap-6">
            <p
              style={stagger(0)}
              className="hero-rise inline-flex items-center gap-3 rounded-full border border-bBORDERFADE bg-bCHIP py-2 pl-3 pr-4 text-sm font-medium"
            >
              <span
                aria-hidden="true"
                className="status-ping relative h-2.5 w-2.5 rounded-full bg-bICON text-bICON"
              />
              {hero.status}
            </p>

            <h1
              id="hero-title"
              style={stagger(1)}
              className="hero-rise max-w-[18ch] text-balance text-[length:clamp(2.25rem,5.4vw,4.25rem)] font-semibold leading-[1.05] tracking-[-0.03em]"
            >
              {hero.title}
            </h1>

            <p
              style={stagger(2)}
              className="hero-rise max-w-[48ch] text-lg leading-relaxed opacity-70"
            >
              {hero.subtitle}
            </p>

            <div
              style={stagger(3)}
              className="hero-rise flex w-full flex-col gap-3 min-[480px]:w-auto min-[480px]:flex-row min-[480px]:items-center"
            >
              <Link
                href={hero.primary.href}
                className="press arrow-nudge inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-bCHIPSELECTED px-7 text-[15px] font-semibold text-white outline-offset-4 dark:text-black"
              >
                {hero.primary.label}
                <ArrowDown size={18} aria-hidden="true" />
              </Link>
              <Link
                href={hero.secondary.href}
                className="press arrow-nudge inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-bBORDERFADE bg-bCARD px-7 text-[15px] font-semibold outline-offset-4"
              >
                {hero.secondary.label}
                <ArrowUpRight
                  size={18}
                  aria-hidden="true"
                  className="arrow-nudge-icon"
                />
              </Link>
            </div>
          </div>

          <div
            style={stagger(2)}
            className="hero-rise relative mx-auto w-full max-w-[420px] lg:max-w-none"
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-[16px] border border-bBORDERFADE bg-bCARD">
              <Image
                src="/me/sahan.webp"
                alt={`Portrait of ${Site.authorFullName}`}
                fill
                priority
                sizes="(min-width: 896px) 32vw, (min-width: 640px) 56vw, 84vw"
                className="object-cover object-top"
              />
              <BorderBeam
                size={220}
                duration={14}
                colorFrom="#6bff60"
                colorTo="#166534"
              />
            </div>

            <div className="absolute -bottom-4 left-4 right-4 flex items-center gap-3 rounded-[12px] border border-bBORDERFADE bg-bFCARD px-4 py-3 shadow-lg lg:left-6 lg:right-auto">
              <div className="text-sm leading-tight">
                <div className="font-semibold">{Site.myRole}</div>
                <div className="opacity-70">{Site.org}</div>
              </div>
            </div>
          </div>
        </div>
      </WrapperBody>
    </section>
  );
};

export default HomeHero;
