import ContactChannels from "@/components/home/ContactChannels";
import { HomeContainer, stagger } from "@/components/home/HomeSection";
import RunnerTrack from "@/components/about/RunnerTrack";
import Particals from "@/components/custom/Particals";
import { BorderBeam } from "@/components/ui/border-beam";
import { Site, SiteMetadata } from "@/config/site";
import { AboutContent } from "@/contents/about";
import { righteous } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Flag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

// The home hero is a left-aligned pitch with a portrait card. This one is a
// person, not a pitch: a banner with a small journey (the runner heads for
// the current employer), the portrait sitting on its lower edge, and the name
// leading. Centered, so the two pages never read as the same layout.
const AboutHero = () => {
  const { SE1 } = AboutContent;
  const roles = [SE1.title.line1, SE1.title.line2]
    .join(" ")
    .split(".")
    .map((role) => role.trim())
    .filter(Boolean);

  return (
    <section
      id="about-hero"
      aria-labelledby="about-title"
      className="w-full pb-[clamp(3rem,6vw,5rem)] pt-[clamp(6.5rem,11vw,8.5rem)]"
    >
      <HomeContainer>
        {/* STAGE: banner + portrait resting on its lower edge */}
        <div
          style={stagger(0)}
          className="hero-rise relative mb-[clamp(4.5rem,9vw,6.5rem)]"
        >
          <div className="relative h-[clamp(170px,24vw,280px)] rounded-[28px] border border-bBORDERFADE bg-bCARD">
            <div className="absolute inset-0 overflow-hidden rounded-[28px] [container-type:inline-size]">
              <div aria-hidden="true" className="hero-glow absolute -inset-[10%]" />
              <div aria-hidden="true" className="hero-grid absolute inset-0" />
              <Particals quantity={60} size={0.5} />

              {/* ground line the runner follows */}
              <div
                aria-hidden="true"
                className="absolute inset-x-6 bottom-3 border-b border-dashed border-bBORDERFADE"
              />
              <RunnerTrack />

              {/* destination: where the journey currently ends */}
              <a
                href={Site.orgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="press arrow-nudge absolute right-4 top-4 z-10 inline-flex min-h-11 items-center gap-2 rounded-full border border-bBORDERFADE bg-bFCARD px-4 text-[13px] font-semibold shadow-md s640:bottom-6 s640:right-6 s640:top-auto"
              >
                <Flag size={14} aria-hidden="true" className="text-bICON" />
                <span>
                  Now at {Site.org}
                  <span className="sr-only"> (opens in a new tab)</span>
                </span>
                <ArrowUpRight
                  size={14}
                  aria-hidden="true"
                  className="arrow-nudge-icon"
                />
              </a>
            </div>

            {/* portrait straddling the banner edge */}
            <div className="absolute bottom-0 left-1/2 z-20 aspect-square w-[clamp(132px,18vw,208px)] -translate-x-1/2 translate-y-1/2 rounded-full border border-bBORDERFADE bg-bFCARD p-1.5 shadow-lg">
              <div className="relative h-full w-full overflow-hidden rounded-full">
                <Image
                  src="/me/sahan.webp"
                  alt={`Portrait of ${Site.authorFullName}`}
                  fill
                  priority
                  sizes="208px"
                  className="object-cover [object-position:50%_12%]"
                />
              </div>
              <BorderBeam size={120} duration={8} />
            </div>
          </div>
        </div>

        {/* NAME FIRST, THEN THE STORY */}
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex flex-col items-center gap-2">
            <h1
              id="about-title"
              style={stagger(1)}
              className={cn(
                righteous.className,
                "hero-rise text-[length:clamp(2rem,1.2rem+3.6vw,3.75rem)] uppercase leading-[1.05] tracking-[0.02em]"
              )}
            >
              {SiteMetadata.legalName}
            </h1>
            <p
              style={stagger(2)}
              className="hero-rise text-sm opacity-70"
            >
              {Site.gitHubUser}
            </p>
          </div>

          <ul
            style={stagger(2)}
            aria-label="What I am"
            className="hero-rise flex flex-wrap justify-center gap-2"
          >
            {roles.map((role) => (
              <li
                key={role}
                className="rounded-full border border-bBORDERFADE bg-bCHIP px-4 py-1.5 text-sm font-medium"
              >
                {role}
              </li>
            ))}
          </ul>

          <p
            style={stagger(3)}
            className="hero-rise max-w-[58ch] text-[length:clamp(1.05rem,0.95rem+0.4vw,1.2rem)] leading-relaxed opacity-75"
          >
            {SE1.description}
          </p>

          <p
            style={stagger(3)}
            className="hero-rise text-sm font-medium opacity-80"
          >
            {Site.tagline}
          </p>

          <div
            style={stagger(4)}
            className="hero-rise flex w-full flex-col items-stretch justify-center gap-3 s480:w-auto s480:flex-row s480:items-center"
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

          <div style={stagger(5)} className="hero-rise w-full max-w-[460px]">
            <ContactChannels variant="tiles" />
          </div>
        </div>
      </HomeContainer>
    </section>
  );
};

export default AboutHero;
