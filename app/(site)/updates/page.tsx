import FinalCta from "@/components/home/FinalCta";
import HeroBackdrop from "@/components/home/HeroBackdrop";
import { HomeContainer, stagger } from "@/components/home/HomeSection";
import UpdatesExplorer from "@/components/updates/UpdatesExplorer";
import { UpdatesContent } from "@/contents/updates";
import React from "react";

const Updates = () => (
  <div className="w-full overflow-hidden font-medium">
    <section aria-labelledby="updates-title" className="w-full">
      <HeroBackdrop>
        <div className="flex pb-[clamp(2.5rem,5vw,4rem)] pt-[clamp(6.5rem,12vw,9rem)]">
          <HomeContainer>
            <div className="flex flex-col items-start gap-6">
              <h1
                id="updates-title"
                style={stagger(0)}
                className="hero-rise max-w-[16ch] text-balance text-[length:clamp(2.25rem,1.1rem+4.6vw,5rem)] font-semibold leading-[1.04] tracking-[-0.03em]"
              >
                {UpdatesContent.title.w1}{" "}
                <span className="text-bICON">{UpdatesContent.title.w2}</span>
              </h1>
              <p
                style={stagger(1)}
                className="hero-rise max-w-[52ch] text-[length:clamp(1.05rem,0.9rem+0.5vw,1.3rem)] leading-relaxed opacity-70"
              >
                {UpdatesContent.subtitle}
              </p>
            </div>
          </HomeContainer>
        </div>
      </HeroBackdrop>
    </section>

    <UpdatesExplorer />
    <FinalCta />
  </div>
);

export default Updates;
