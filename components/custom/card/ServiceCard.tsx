"use client";

import Link from "next/link";
import React from "react";
import { motion } from "framer-motion";

const ServiceCard = ({
  title = "Service",
  description = "",
  path = "/",
  className = "flex",
  width = 288,
  height = 200,
  initial = { rotate: -720, y: -400 },
  animate = { rotate: 0, y: 0 },
  transition = { type: "spring", duration: 1.5, delay: 0.2 },
}) => {
  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition}
      className={`${className} border rounded-[24px] justify-center items-center p-4 max-h-full max-w-full self-stretch backdrop-blur-xl
      `}
      style={{
        width: `${width}px`,
        height: `${height !== 200 ? height + "px" : "auto"}`,
        minHeight: "200px",
      }}
    >
      <Link
        href={path}
        className={`p-2 w-full h-full flex flex-col justify-center items-center `}
      >
        <p className="text-2xl font-bold text-green-400 text-center pb-1">
          {title}
        </p>
        <p className="text-xl font-semibold text-gray-500 text-center overflow-wrap break-words dark:text-gray-300">
          {description}
        </p>
      </Link>
    </motion.div>
  );
};

export default ServiceCard;
