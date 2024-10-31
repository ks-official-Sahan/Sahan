import WrapperBody from "@/components/wrappers/WrapperBody";
import { Site, SiteMetadata } from "@/config/site";
import { righteous } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import React from "react";
import { Image as NextUiImage } from "@nextui-org/react";
import { AboutContent } from "@/contents/about";
import { BorderBeam } from "@/components/ui/border-beam";
import AnimatedShinyText from "@/components/ui/animated-shiny-text";
import { PinContainer } from "@/components/ui/3d-pin";
import SkillCard from "@/components/common/SkillCard";
import GridCardWrap from "@/components/custom/about/GridCardWrap";
import Runner from "@/components/custom/about/Runner";
import Particals from "@/components/custom/Particals";

const About = () => {
  return (
    <div className="w-full min-h-screen flex flex-col font-medium pb-[60px] overflow-hidden">
      {/* HERO SECTION */}
      <section className="w-full flex flex-col items-center pt-[111px]">
        <div className="w-full">
          <WrapperBody>
            <div className="border rounded-[12px]">
              <div className="w-full h-[200px] from-[#fafafa] to-white dark:from-[#101010] dark:to-black bg-gradient-to-t rounded-[12px] relative flex flex-col items-center">
                <Particals />
                <div className="absolute bottom-0 left-[20px]">
                  <Runner />
                </div>
                <div className="absolute bottom-[-96px] right-[-100px]">
                  <PinContainer
                    title="Destination!"
                    href="https://evisionit.lk"
                    className="absolute bottom-0 right-[20px]"
                  >
                    <div className="bg-transparent"></div>
                  </PinContainer>
                </div>
                <div className="absolute bottom-[-100px]">
                  <div className="w-[212px] h-[212px] border-x border-t rounded-full relative bg-[#00000013] backdrop-blur-sm flex justify-center items-center">
                    <BorderBeam size={120} duration={6} delay={8} />
                    <NextUiImage
                      src="/me/sahan.webp"
                      alt={SiteMetadata.legalName}
                      width={200}
                      height={200}
                      className="object-cover rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* NAME, USERNAME, TAGLINE */}
            <div className="pt-[120px] flex flex-col items-center text-center">
              <div
                className={cn(
                  righteous.className,
                  "uppercase text-[2rem] leading-[32px]"
                )}
              >
                {SiteMetadata.legalName}
              </div>
              <div className="pt-[10px] text-secondaryT pb-[2px]">
                {Site.gitHubUser}
              </div>
              <AnimatedShinyText className="inline-flex items-center justify-center py-1 transition ease-out hover:text-neutral-600 hover:duration-300 hover:dark:text-neutral-400">
                <span>{Site.tagline}</span>
              </AnimatedShinyText>
            </div>
          </WrapperBody>
        </div>
      </section>

      {/* BENTO GRID */}
      <section className="w-full flex flex-col items-center pt-[60px]">
        <WrapperBody>
          <div className="w-full grid lg:grid-cols-3 sm:grid-cols-1 gap-[10px]">
            {/* COL1 */}
            <div className="w-full flex flex-col md:flex-row gap-[10px] broder-3 border-white">
              {/* CARD 1 */}
              <GridCardWrap>
                <AnimatedShinyText className="inline-flex items-center justify-center  py-1 transition ease-out hover:text-purple-600 hover:duration-500 hover:dark:text-purple-500">
                  <span className="text-[26px] font-semibold">
                    {AboutContent.bento.B1.title}
                  </span>
                </AnimatedShinyText>

                <div className="text-[14px] font-medium opacity-80 pt-3">
                  {AboutContent.bento.B1.description}
                </div>
              </GridCardWrap>

              {/* CARD 4 */}
              <GridCardWrap></GridCardWrap>
            </div>

            {/* COL2 */}
            <div className="w-full flex flex-col md:flex-row gap-[10px]">
              {/* CARD 2 */}
              <GridCardWrap></GridCardWrap>
            </div>

            {/* COL3 */}
            <div className="w-full flex flex-col md:flex-row gap-[10px]">
              {/* CARD 3 */}
              <GridCardWrap></GridCardWrap>
              {/* CARD 5 */}
              <GridCardWrap></GridCardWrap>
            </div>
          </div>
        </WrapperBody>
      </section>

      {/* KNOWLADGE BASE */}
      <section className="flex flex-col items-center pt-[80px] ">
        <WrapperBody>
          <div className="flex flex-col items-center ">
            {/* TITLE */}
            <div className="flex flex-col items-center text-center pb-[60px]">
              <div className="text-[26px] font-semibold">
                {AboutContent.KB.title}
              </div>
              <div className="text-[15px] font-medium text-secondaryT">
                {AboutContent.KB.description}
              </div>
            </div>

            {/* SKILLS GRID */}
            {/* <div className='w-full h-[60px] border-x border-t border-b border-dashed flex items-center'>
                  <div className='text-[20px] font-semibold pl-[26px]'>Developer Skills</div>
              </div> */}
            <div className="flex flex-wrap justify-center">
              {AboutContent.KB.skills.dev.map((skill, index) => {
                const IconComponent = skill.icon;
                return (
                  <SkillCard
                    key={index}
                    title={skill.title}
                    bgColors={skill.bgColors}
                    colors={skill.colors}
                    icon={
                      <IconComponent className="fill-black dark:fill-white group-hover/canvas-card:fill-white" />
                    }
                  />
                );
              })}
            </div>
            {/* <div className='w-full h-[60px] border-x border-t border-dashed flex items-center'>
                  <div className='text-[20px] font-semibold pl-[26px]'>Design Skills</div>
              </div> */}
          </div>
        </WrapperBody>
      </section>
    </div>
  );
};

export default About;
