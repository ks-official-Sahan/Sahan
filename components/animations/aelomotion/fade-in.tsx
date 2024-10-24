"use client"
import React from 'react';

import { motion } from "framer-motion";

const FadeIn = ({ children, animate, initial, className, transition }: FadeInProps) => {

    return (
      <motion.div
        /* eslint-disable @typescript-eslint/no-explicit-any */
        initial={initial as any}
        animate={animate as any}
        transition={transition}
        className={className}
      >
        {children}
      </motion.div>
    );
};

export default FadeIn;
