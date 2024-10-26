import EVISIONIT_ICON from "@/components/icons/EvisionIT";
import VIP_ICON from "@/components/icons/VIP";
import { Site } from "@/config/site";
import { righteous } from "@/lib/fonts";
import { Button } from "@nextui-org/react";
import { motion } from "framer-motion";
import Link from "next/link";
import React from "react";

const CompanyCard = ({
  className = "flex ",
  width = 288,
  height = 220,
  initial = { x: -400 },
  animate = { x: 0 },
  transition = { type: "spring", duration: 1.5, delay: 0.5 },
}) => {
  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition}
      className={`${className} w-[${width}px] min-h-[${height}px] 
      flex-col items-center justify-center box-border 
      px-[25px] pt-[30px] pb-[20px] rounded-[24px] border bg-[#f7f7f7] dark:bg-[#00000052]`}
    >
      <div className="w-[80px] h-[80px] rounded-full bg-black dark:bg-white flex justify-center items-center pt-[3px]">
        <EVISIONIT_ICON
          className="fill-white dark:fill-black"
          width={60}
          height={30}
        />
      </div>
      <div className="text-[10px] font-medium opacity-65 pt-[14px]">
        Founder & CEO of Evision IT
      </div>

      <Link
        href={Site.orgUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full"
      >
        <Button className="mt-[20px] justify-start text-center h-[40px] w-full border rounded-full p-[4px] flex items-center gap-[10px] bg-[#ffffff75] dark:bg-[#00000075] backdrop-blur-sm">
          <div className="p-[8px] flex justify-center items-center border bg-[#f7f7f756] dark:bg-[#23232356] backdrop-blur-sm rounded-full w-fit h-fit">
            <VIP_ICON className="fill-[#FFB84D]" />
          </div>
          <span
            className={`${righteous.className} text-[14px] bg-evisionBro text-center w-full bg-clip-text text-transparent`}
          >
            www.evisionit.lk
          </span>
        </Button>
      </Link>
    </motion.div>
  );
};

export default CompanyCard;
