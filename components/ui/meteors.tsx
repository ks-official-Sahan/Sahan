"use client";
import { cn } from "@/lib/utils";
import React, { useMemo } from "react";

export const Meteors = ({
  number,
  className,
}: {
  number?: number;
  className?: string;
}) => {
  const meteors = useMemo(() => {
    const count = number || 20;
    return Array.from({ length: count }, (_, idx) => {
      // Deterministic generation derived from index to ensure SSR and hydration match
      const seed = (idx * 9301 + 49297) % 233280;
      const factor = seed / 233280;
      const left = Math.floor(factor * (400 - -400) + -400) + "px";
      const animationDelay = (0.2 + ((idx * 0.17) % 0.6)).toFixed(2) + "s";
      const animationDuration = Math.floor(2 + (idx % 8)) + "s";
      return {
        left,
        animationDelay,
        animationDuration,
      };
    });
  }, [number]);

  return (
    <>
      {meteors.map((meteor, idx) => (
        <span
          key={"meteor" + idx}
          className={cn(
            "animate-meteor-effect absolute top-1/2 left-1/2 h-0.5 w-0.5 rounded-[9999px] bg-slate-500 shadow-[0_0_0_1px_#ffffff10] rotate-[215deg]",
            "before:content-[''] before:absolute before:top-1/2 before:transform before:-translate-y-[50%] before:w-[50px] before:h-[1px] before:bg-gradient-to-r before:from-[#64748b] before:to-transparent",
            className
          )}
          style={{
            top: 0,
            left: meteor.left,
            animationDelay: meteor.animationDelay,
            animationDuration: meteor.animationDuration,
          }}
        ></span>
      ))}
    </>
  );
};
