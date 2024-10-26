import { RubberBandElement } from "@/components/animations/shoelace/rubber-band";
import { Site, SiteMetadata } from "@/config/site";
import Image from "next/image";
import React from "react";

const UserCard = ({ className = "flex ", width = 406, height = 362 }) => {
  //   alert(className + " " + width + " " + height);
  return (
    <RubberBandElement>
      <div
        className={`${className} w-[${width}px] h-[${height}px] rounded-[24px] border relative flex-col items-center`}
      >
        <div className="w-full h-full absolute rounded-[24px] from-[#f0f0f0] to-white dark:from-[#1B1C1D] dark:to-[#000000] bg-gradient-to-b opacity-55"></div>

        <Image
          src={"/me/sahan.svg"}
          // fill
          width={width - 20}
          height={height - 40}
          alt={Site.author}
          quality={70}
          priority
        />

        <div className="px-[16px] py-[6px] rounded-[10px] border  absolute bottom-[40px] bg-[#ffffff68] dark:bg-[#00000068] backdrop-blur-sm">
          <div className="text-[14px] font-medium opacity-65">
            {SiteMetadata.legalName}
          </div>
        </div>
      </div>
    </RubberBandElement>
  );
};

export default UserCard;
