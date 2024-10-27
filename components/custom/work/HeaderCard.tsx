import React from "react";
import { motion } from "framer-motion";

/* eslint-disable @typescript-eslint/no-explicit-any */ 

interface HeaderCardProps {
  children: React.ReactNode;
  className?: string;
  workType?: "design" | "project" | string;
  title?: string;
  initial?: any;
  rotate?: number;
  animate?: any;
  transition?: any;
}

const HeaderCard = ({
  children,
  className = "",
  workType,
  title = "design",
  rotate = -5,
  initial = { opacity: 0, y: 40, rotate: -(rotate) },
  animate = {
    opacity: 1,
    y: 20,
    rotate: workType === title ? rotate : 0,
  },
  transition = { duration: 1, type: "spring" },
}: HeaderCardProps) => {
  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition}
      className={`${className} relative`}
    >
      {children}
    </motion.div>
  );
};

export default HeaderCard;
