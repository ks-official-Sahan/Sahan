"use client";

import { RubberBandElement } from "@/components/animations/shoelace/rubber-band";
import { SiteMetadata } from "@/config/site";
import React from "react";
import { motion } from "framer-motion";
import UserCardImage from "./UserCardImage";

const UserCard = ({
  className = "flex ",
  width = 406,
  height = 362,
  initial = { y: 200 },
  animate = { y: 0 },
  transition = { type: "spring", duration: 1.5, delay: 0.2 },
}) => {
  //   alert(className + " " + width + " " + height);
  return (
    <RubberBandElement>
      <motion.div
        initial={initial}
        animate={animate}
        transition={transition}
        className={`${className} w-[${width}px] h-[${height}px] rounded-[24px] border relative flex-col items-center`}
      >
        <div className="w-full h-full absolute rounded-[24px] from-[#f0f0f0] to-white dark:from-[#1B1C1D] dark:to-[#000000] bg-gradient-to-b opacity-55"></div>

        <UserCardImage width={width} height={height} />

        <div className="px-[16px] py-[6px] rounded-[10px] border  absolute bottom-[40px] bg-[#ffffff68] dark:bg-[#00000068] backdrop-blur-sm">
          <div className="text-[14px] font-medium opacity-65">
            {SiteMetadata.legalName}
          </div>
        </div>
      </motion.div>
    </RubberBandElement>
  );
};

export default UserCard;
