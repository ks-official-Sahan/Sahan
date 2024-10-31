"use client";

import React from "react";
import { motion } from "framer-motion";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface GridCardWrapProps {
  children?: React.ReactNode;
  className?: string;
  height?: number;
  initial?: any;
  animate?: any;
  transition?: object;
}

const GridCardWrap = ({
  children,
  className = "",
  height = 255,
  initial = { x: -400 },
  animate = { x: 0 },
  transition = { type: "spring", duration: 1.5, delay: 0.5 },
}: GridCardWrapProps) => {
  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition}
      className={`${className} w-full flex-1 min-h-[${height}px] bg-[#f7f7f7] dark:bg-[#1A1A1A] border rounded-[12px] py-[24px] px-[24px] flex flex-col self-stretch justify-center items-center`}
    >
      {children ?? children}
    </motion.div>
  );
};

export default GridCardWrap;
