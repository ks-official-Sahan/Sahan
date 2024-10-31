import Particals from "@/components/custom/Particals";
import FilterSection from "@/components/updates/FilterSection";
import UpdatesCard from "@/components/updates/UpdatesCard";
import WrapperBody from "@/components/wrappers/WrapperBody";
import { UpdatesContent } from "@/contents/updates";
import { righteous } from "@/lib/fonts";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { cn } from "@/lib/utils";
import React from "react";

const Updates = () => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center pb-[60px] relative">
      <Particals />

      {/* TOP */}
      <section className="flex flex-col items-center pt-[100px] lg:pt-[151px] text-center">
        <WrapperBody>
          <div className="w-full flex flex-col items-center">
            {/* TITLE */}
            <div
              className={cn(
                righteous.className,
                "flex items-center uppercase text-[40px] gap-2 font-bold"
              )}
            >
              <div>{UpdatesContent.title.w1}</div>
              <div className="text-[#91FF00]">{UpdatesContent.title.w2}</div>
            </div>

            {/* SUB-TITLE */}
            <div className="text-[18px] font-medium opacity-65">
              <div>{UpdatesContent.subtitle}</div>
            </div>
          </div>
        </WrapperBody>
      </section>

      {/* CONTENT */}
      <section className="flex flex-col items-center pt-[30px] lg:pt-[80px]">
        <WrapperBody>
          <div className="flex justify-center items-center flex-col lg:flex-row lg:items-start lg:justify-end w-full ">
            {/* FILTER SECTION */}
            <FilterSection className="hidden sm:flex md:flex" />

            {/* POST CARDS */}
            <div className="flex flex-col items-center gap-[24px] z-[100] w-full lg:w-9/12">
              {UpdatesContent.posts.map((post, index) => (
                <UpdatesCard {...post} key={index} />
              ))}
            </div>

            {/* FILTER SECTION */}
            <FilterSection className="flex sm:hidden md:hidden" />
          </div>
        </WrapperBody>
      </section>
    </div>
  );
};

export default Updates;
