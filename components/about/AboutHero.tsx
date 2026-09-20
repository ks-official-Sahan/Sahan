import ContactChannels from "@/components/home/ContactChannels";
import HeroBackdrop from "@/components/home/HeroBackdrop";
import { HomeContainer, stagger } from "@/components/home/HomeSection";
import RandomIam from "@/components/home/RandomIam";
import { BorderBeam } from "@/components/ui/border-beam";
import { Site } from "@/config/site";
import { AboutContent } from "@/contents/about";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

// Same visual language as the home hero so the two pages feel like one
// product: chip, big line, one paragraph, two actions, a face.
const AboutHero = () => {
  const { SE1 } = AboutContent;

  return (
    <section id="about-hero" aria-labelledby="about-title" className="w-full">
      <HeroBackdrop>
        <div className="flex pb-[clamp(3rem,6vw,5rem)] pt-[clamp(6.5rem,12vw,9rem)]">
          <HomeContainer>
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center lg:gap-10 xl:gap-16">
              <div className="flex flex-col items-start gap-6 lg:col-span-7">
                <p
                  style={stagger(0)}
                  className="hero-rise inline-flex items-center gap-3 rounded-full border border-bBORDERFADE bg-bCHIP py-2 pl-3 pr-4 text-sm font-medium"
                >
                  <span
                    aria-hidden="true"
                    className="status-ping relative h-2.5 w-2.5 rounded-full bg-bICON text-bICON"
                  />
                  {Site.location}
                </p>

                <h1
                  id="about-title"
                  style={stagger(1)}
                  className="hero-rise text-balance text-[length:clamp(2.25rem,1.1rem+4.4vw,4.75rem)] font-semibold leading-[1.05] tracking-[-0.03em]"
                >
                  {SE1.title.line1}{" "}
                  <span className="text-bICON">{SE1.title.line2}</span>
                </h1>

                <p
                  style={stagger(2)}
                  className="hero-rise max-w-[56ch] text-[length:clamp(1.05rem,0.9rem+0.5vw,1.25rem)] leading-relaxed opacity-70"
                >
                  {SE1.description}
                </p>

                <div
                  style={stagger(3)}
                  className="hero-rise flex w-full flex-col gap-3 s480:w-auto s480:flex-row s480:items-center"
                >
                  <Link
                    href="/contact"
                    className="press arrow-nudge inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-bCHIPSELECTED px-7 text-[15px] font-semibold text-white dark:text-black"
                  >
                    Start a project
                    <ArrowUpRight
                      size={18}
                      aria-hidden="true"
                      className="arrow-nudge-icon"
                    />
                  </Link>
                  <Link
                    href="/works"
                    className="press arrow-nudge inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-bBORDERFADE bg-bCARD px-7 text-[15px] font-semibold"
                  >
                    See my work
                    <ArrowUpRight
                      size={18}
                      aria-hidden="true"
                      className="arrow-nudge-icon"
                    />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 s640:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
                <div
                  style={stagger(2)}
                  className="hero-rise relative aspect-[5/4] overflow-hidden rounded-[20px] border border-bBORDERFADE bg-bCARD s640:aspect-auto s640:min-h-[280px] lg:aspect-[4/3.4]"
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
                </div>

                <div style={stagger(3)} className="hero-rise flex flex-col gap-3">
                  <RandomIam />
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

export default AboutHero;
