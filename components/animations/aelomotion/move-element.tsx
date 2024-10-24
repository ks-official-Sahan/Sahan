"use client";
import React from "react";
import { motion, MotionProps } from "framer-motion";

interface MoveElementProps extends MotionProps {
  children: React.ReactNode;
  initial?: boolean | string;
  animate: boolean | string;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  transition?: any;
  className?: string;
}

const MoveElement = ({
  children,
  animate,
  initial,
  transition,
  className,
}: MoveElementProps) => {
  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default MoveElement;
