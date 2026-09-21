"use client";

import { useTheme } from "next-themes";
import { useReducedMotion } from "framer-motion";
import React, { useEffect, useState } from "react";
import ParticlesX from "../animations/ParticlesX";

const Particals = ({
  className = "absolute inset-0",
  quantity = 100,
  size = 0.5,
}) => {
  const { theme } = useTheme();
  const [color, setColor] = useState("#ffffff");
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted)
      setColor(
        theme === "dark"
          ? "#ffffff"
          : theme === "system"
          ? "#a855f7"
          : "#000000"
      );
  }, [theme, mounted]);

  if (!mounted || reduceMotion) return null;

  return (
    <>
      <ParticlesX
        vx={-0.8}
        className={className}
        quantity={quantity}
        ease={80}
        color={color}
        size={size}
        refresh
      />
    </>
  );
};

export default Particals;
