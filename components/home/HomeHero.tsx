import ContactChannels from "@/components/home/ContactChannels";
import HeroBackdrop from "@/components/home/HeroBackdrop";
import { HomeContainer, stagger } from "@/components/home/HomeSection";
import RandomIam from "@/components/home/RandomIam";
import { BorderBeam } from "@/components/ui/border-beam";
import { Site } from "@/config/site";
import { HomeContent } from "@/contents/home";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

// One hero, four layouts. The copy stays the same; the arrangement changes
// with the viewport:
//   phone   (<640)    text, then a 2-up bento under it
//   tablet  (640-1023) portrait spans two rows beside the small cards
//   laptop  (1024+)   text left, bento right, hero fills the screen height
//   wide    (1536+)   same split, bigger type and a wider container
const HomeHero = () => {
  const { hero, channels } = HomeContent;

  return (
    <section id="hero" aria-labelledby="hero-title" className="w-full">
      <HeroBackdrop>
        <div className="flex pb-[clamp(3rem,6vw,5rem)] pt-[clamp(6.5rem,12vw,9rem)] lg:min-h-[min(100svh,62rem)] lg:items-center">
          <HomeContainer>
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center lg:gap-10 xl:gap-16">
              {/* COPY */}
              <div className="flex flex-col items-start gap-6 lg:col-span-7">
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
                  className="hero-rise max-w-[20ch] text-balance text-[length:clamp(2.25rem,1.1rem+4.6vw,5rem)] font-semibold leading-[1.04] tracking-[-0.03em]"
                >
                  {hero.title}
                </h1>

                <p
                  style={stagger(2)}
                  className="hero-rise max-w-[46ch] text-[length:clamp(1.05rem,0.9rem+0.5vw,1.3rem)] leading-relaxed opacity-70"
                >
                  {hero.subtitle}
                </p>

                <div
                  style={stagger(3)}
                  className="hero-rise flex w-full flex-col gap-3 s480:w-auto s480:flex-row s480:items-center"
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

              {/* BENTO */}
              <div className="grid grid-cols-2 gap-3 s640:gap-4 lg:col-span-5">
                {/* portrait */}
                <div
                  style={stagger(2)}
                  className="hero-rise relative col-span-2 aspect-[5/4] overflow-hidden rounded-[16px] border border-bBORDERFADE bg-bCARD s640:col-span-1 s640:row-span-2 s640:aspect-auto lg:col-span-2 lg:row-span-1 lg:aspect-[16/11] xl:aspect-[16/12]"
                >
                  <Image
                    src="/me/sahan.webp"
                    alt={`Portrait of ${Site.authorFullName}`}
                    fill
                    priority
                    sizes="(min-width: 1536px) 30vw, (min-width: 1024px) 40vw, (min-width: 640px) 45vw, 92vw"
                    className="object-cover object-top"
                  />
                  <BorderBeam
                    size={220}
                    duration={14}
                    colorFrom="#6bff60"
                    colorTo="#166534"
                  />
                  <div className="absolute bottom-3 left-3 rounded-[10px] border border-bBORDERFADE bg-bFCARD px-3 py-2 text-[13px] leading-tight shadow-md">
                    <div className="font-semibold">{Site.myRole}</div>
                  </div>
                </div>

                {/* employer */}
                <a
                  href={Site.orgUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={stagger(3)}
                  className="hero-rise press lift arrow-nudge flex min-h-[132px] flex-col justify-between gap-4 rounded-[16px] border border-bBORDERFADE bg-bCARD p-5"
                >
                  <span className="text-sm opacity-70">Working with</span>
                  <span className="text-lg font-semibold leading-tight">
                    {Site.org}
                    <span className="sr-only"> {channels.newTab}</span>
                  </span>
                  <span className="flex items-center justify-between text-xs opacity-70">
                    Software Engineer
                    <ArrowUpRight
                      size={16}
                      aria-hidden="true"
                      className="arrow-nudge-icon"
                    />
                  </span>
                </a>

                {/* I'm a ... */}
                <div style={stagger(4)} className="hero-rise">
                  <RandomIam />
                </div>

                {/* direct lines */}
                <div
                  style={stagger(5)}
                  className="hero-rise col-span-2 flex flex-col gap-3 rounded-[16px] border border-bBORDERFADE bg-bCARD p-4"
                >
                  <h2 className="text-sm font-semibold">{channels.title}</h2>
                  <ContactChannels variant="tiles" />
                </div>
              </div>
            </div>
          </HomeContainer>
        </div>
      </HeroBackdrop>
    </section>
  );
};

export default HomeHero;
