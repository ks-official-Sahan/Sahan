"use client";

import React from "react";
import { motion } from "framer-motion";

const AnimatedWrapper = ({
  children,
  className,
  id = "bento",
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) => {
  return (
    <motion.div
      id={id}
      initial={{ y: 0, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", duration: 7 }}
      className={`${className}`}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedWrapper;
