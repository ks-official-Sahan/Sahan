"use client"; // Ensure this is required for your use case

import WrapperBody from "@/components/wrappers/WrapperBody";
import { Site, SiteMetadata } from "@/config/site";
import { righteous } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import Image from "next/image";
import React, { useEffect, useState, useLayoutEffect } from "react";
import { Image as NextUiImage } from "@nextui-org/react";
import { AboutContent } from "@/contents/about";
import { BorderBeam } from "@/components/ui/border-beam";
import AnimatedShinyText from "@/components/ui/animated-shiny-text";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import ParticlesX from "@/components/animations/ParticlesX";
import { PinContainer } from "@/components/ui/3d-pin";
import SkillCard from "@/components/common/SkillCard";

const About = () => {
  const { theme } = useTheme();
  const [color, setColor] = useState("#ffffff");

  useEffect(() => {
    setColor(theme === "dark" ? "#ffffff" : "#000000");
  }, [theme]);

  const [sprite, setSprite] = useState(1);

  const run = () => {
    setSprite((prev) => (prev === 8 ? 1 : prev + 1));
  };

  useLayoutEffect(() => {
    const intervalId = setInterval(run, 56);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="w-full min-h-screen flex flex-col font-medium pb-[60px] overflow-hidden">
      {/* HERO SECTION */}
      <section className="w-full flex flex-col items-center pt-[111px]">
        <div className="w-full">
          <WrapperBody>
            <div className="border rounded-[12px]">
              <motion.div className="w-full h-[200px] from-[#fafafa] to-white dark:from-[#101010] dark:to-black bg-gradient-to-t rounded-[12px] relative flex flex-col items-center">
                <ParticlesX
                  vx={-0.8}
                  className="absolute inset-0"
                  quantity={100}
                  ease={80}
                  color={color}
                  refresh
                />
                <div className="absolute bottom-0 left-[20px]">
                  <Image
                    src={`/gm/s1/run-${sprite}.png`}
                    alt="Sprite"
                    width={80}
                    height={80}
                    className="object-cover"
                  />
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
              </motion.div>
            </div>

            {/* NAME, USERNAME, TAGLINE */}
            <div className="pt-[120px] flex flex-col items-center text-center">
              <div className={cn(righteous.className, "uppercase text-[2rem] leading-[32px]")}>
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
          <div className="w-full grid grid-cols-3 gap-[10px]">
            {/* COL1 */}
            <div className="w-full flex flex-col gap-[10px] ">
              {/* ROW 1 */}
              <div className="w-full h-[255px] bg-[#f7f7f7] dark:bg-[#1A1A1A] border rounded-[12px] py-[24px] px-[24px]">
                <AnimatedShinyText className="inline-flex items-center justify-center  py-1 transition ease-out hover:text-purple-600 hover:duration-500 hover:dark:text-purple-500">
                  <span className="text-[26px] font-semibold">
                    {AboutContent.bento.B1.title}
                  </span>
                </AnimatedShinyText>

                <div className="text-[14px] font-medium opacity-80 pt-3">
                  {AboutContent.bento.B1.description}
                </div>
              </div>

              {/* ROW2 */}
              <div className="w-full h-[255px] bg-[#f7f7f7] dark:bg-[#1A1A1A] border rounded-[12px]"></div>
            </div>

            {/* COL2 */}
            <div className="w-full bg-[#f7f7f7] dark:bg-[#1A1A1A] flex-1 rounded-[12px] border"></div>

            {/* COL3 */}
            <div className="w-full flex flex-col gap-[10px]">
              <div className="w-full h-[255px] bg-[#f7f7f7] dark:bg-[#1A1A1A] border rounded-[12px]"></div>
              <div className="w-full h-[255px] bg-[#f7f7f7] dark:bg-[#1A1A1A] border rounded-[12px]"></div>
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
