"use client";

import React from "react";
import { motion } from "framer-motion";
import { BackgroundBeamsWithCollision } from "@/components/ui/background-beams-with-collision";

/* eslint-disable @typescript-eslint/no-unused-vars */ 

const AboutCard = ({
  className = "flex ",
  width = 288,
  height = 288,
  initial = { opacity: -3, y: 150 },
  inView = { opacity: 1, y: 0 },
  // initial = { rotate: 10, x: 400 },
  // animate = { rotate: 0, x: 0 },
  transition = { type: "spring", duration: 1.5, delay: 0.35 },
}) => {
  return (
    <motion.div
      initial={initial}
      // animate={animate}
      transition={transition}
      whileInView={inView}
      className={`${className}`}
    >
      <BackgroundBeamsWithCollision>
        <div
          className={`w-[${width}px] min-h-[${height}px] rounded-[24px] border bg-[#f7f7f7] dark:bg-[#00000052] px-[40px] py-[50px]`}
        >
          <div className="text-center font-bold text-[2rem]">
            <span className="text-secondaryT">About</span>{" "}
            <span className="text-[#19cf31] dark:text-[#91FF00]">Me</span>
          </div>
          <div className="text-center font-medium text-secondaryT pt-[40px]">
            I create innovative solutions that transform <strong>ideas</strong>{" "}
            into <strong>reality</strong>.
          </div>
        </div>
      </BackgroundBeamsWithCollision>
    </motion.div>
  );
};

export default AboutCard;
