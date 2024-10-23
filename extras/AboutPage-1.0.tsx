/* eslint-disable @typescript-eslint/no-unused-vars */
import WrapperBody from "@/components/wrappers/WrapperBody";
import { Site, SiteMetadata } from "@/config/site";
import { righteous } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import Image from "next/image";
import React from "react";
import { Image as NextUiImage } from "@nextui-org/react";
import { AboutContent } from "@/contents/about";
import { BorderBeam } from "@/components/ui/border-beam";

const About = () => {
  return (
    <div className="w-full min-h-screen flex flex-col font-medium">
      {/* HERO SECTION */}
      <section className="w-full min-h-[372px] from-[#1E1A0A] to-[#111111] bg-gradient-to-b border-b flex flex-col justify-end">
        <div className="w-full">
          <WrapperBody>
            <div className="w-full flex flex-col items-center">
              <div className="w-[645px] h-[190px] rounded-t-[24px] border-t border-x pl-[85px] relative">
                <Image
                  src={"/av/c1.svg"}
                  width={130}
                  height={209}
                  alt="c1"
                  className="absolute object-cover left-[-26px] bottom-[-7px]"
                />

                {/* CONTENT */}
                <div className="flex flex-col pt-[30px]">
                  <div
                    className={cn(
                      righteous.className,
                      "uppercase text-[2rem] leading-[32px]"
                    )}
                  >
                    {SiteMetadata.legalName}
                  </div>
                  <div className="text-[14px] font-medium opacity-90 pt-3">
                    {Site.gitHubUser}
                  </div>
                  <div className="text-[12px] opacity-65 pt-1">
                    {Site.myRole}
                  </div>
                  <div className="text-[12px] mt-[14px] font-medium opacity-65 px-[16px] py-[6px] rounded-[10px] border bg-[#00000060] backdrop-blur-sm w-fit">
                    {Site.companyRole}
                  </div>
                </div>

                {/* PROFILE IMAGE */}
                <div className="absolute bottom-0 right-[-88px]">
                  <div className="w-[212px] h-[212px] border-x border-t rounded-t-full relative  bg-[#00000013] backdrop-blur-sm flex justify-center items-center">
                    {/* <BorderBeam size={250} duration={8} delay={9} /> */}
                    <NextUiImage
                      src="/me/sahan.webp"
                      alt={SiteMetadata.legalName}
                      width={200}
                      height={200}
                      className="object-cover rounded-t-full rounded-b-[4px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </WrapperBody>
        </div>
      </section>

      {/* INTRODUCTION */}
      <section className="w-full pb-[80px]">
        <WrapperBody>
          <div className="w-full border-x border-b h-[420px] rounded-b-[24px] bg-[#00000060] backdrop-blur-sm px-[60px]">
            <div className="pt-[80px] flex gap-[50px]">
              <div className="w-[312px]">
                <NextUiImage
                  isBlurred
                  src="/de/mountains-lake.jpg"
                  alt="About Me"
                  width={312}
                  height={402}
                  className="min-w-[312px] object-cover rounded-[24px] "
                />
              </div>
              <div className="flex flex-col ">
                <div className="text-[2rem] leading-[40px] font-semibold">
                  <div>{AboutContent.SE1.title.line1}</div>
                  <div>{AboutContent.SE1.title.line2}</div>
                </div>
                <div className="font-medium text-secondaryT pt-[20px]">
                  {AboutContent.SE1.description}
                </div>
              </div>
            </div>
          </div>
        </WrapperBody>
      </section>
    </div>
  );
};

export default About;
