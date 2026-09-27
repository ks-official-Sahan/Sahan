import ContactChannels from "@/components/home/ContactChannels";
import HeroBackdrop from "@/components/home/HeroBackdrop";
import { HomeContainer, stagger } from "@/components/home/HomeSection";
import { BorderBeam } from "@/components/ui/border-beam";
import { Site } from "@/config/site";
import type { PageContent } from "@/lib/cms/registry";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

// Clean hero: one promise, two actions, one face. Everything else (channels,
// employer) is quiet supporting detail. The arrangement changes per viewport:
//   phone   (<640)    copy, wide portrait, channel tiles
//   tablet  (640-1023) same order, portrait gets a cinematic crop
//   laptop  (1024+)   copy left, portrait + channels right, fills the screen
//   wide    (1536+)   larger type, wider container
interface HomeHeroProps {
  content: PageContent<"home">["hero"];
  channels: PageContent<"home">["channels"];
}

const HomeHero = ({ content: hero, channels }: HomeHeroProps) => {

  return (
    <section id="hero" aria-labelledby="hero-title" className="w-full">
      <HeroBackdrop>
        <div className="flex pb-[clamp(3rem,6vw,5rem)] pt-[clamp(6.5rem,12vw,9rem)] lg:min-h-[min(100svh,60rem)] lg:items-center">
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

              {/* FACE + DIRECT LINES */}
              <div className="flex flex-col gap-3 lg:col-span-5">
                <div
                  style={stagger(2)}
                  className="hero-rise relative aspect-[5/4] overflow-hidden rounded-[20px] border border-bBORDERFADE bg-bCARD s640:aspect-[16/10] lg:aspect-[4/4.4]"
                >
                  <Image
                    src="/me/sahan.webp"
                    alt={`Portrait of ${Site.authorFullName}`}
                    fill
                    priority
                    sizes="(min-width: 1536px) 30vw, (min-width: 1024px) 40vw, 92vw"
                    className="object-cover object-top"
                  />
                  <BorderBeam
                    className="motion-reduce:hidden"
                    size={220}
                    duration={14}
                    colorFrom="#6bff60"
                    colorTo="#166534"
                  />
                  <a
                    href={Site.orgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="press arrow-nudge absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 rounded-[14px] border border-bBORDERFADE bg-bFCARD px-4 py-3 text-[13px] leading-tight shadow-md s480:right-auto"
                  >
                    <span>
                      <span className="block font-semibold">{Site.myRole}</span>
                      <span className="block opacity-70">
                        at {Site.org}
                        <span className="sr-only"> {channels.newTab}</span>
                      </span>
                    </span>
                    <ArrowUpRight
                      size={16}
                      aria-hidden="true"
                      className="arrow-nudge-icon shrink-0"
                    />
                  </a>
                </div>

                <div style={stagger(4)} className="hero-rise">
                  <ContactChannels content={channels} variant="tiles" />
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
