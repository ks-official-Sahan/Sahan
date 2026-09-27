"use client";

import { useReducedMotion } from "@/lib/use-reduced-motion";
import React, { useEffect, useRef } from "react";

interface CountUpProps {
  to: number;
  suffix?: string;
}

const DURATION_MS = 1100;
// easeOutQuint, the same curve as the site's --ease-out cubic-bezier(0.23, 1, 0.32, 1).
const easeOut = (t: number) => 1 - (1 - t) ** 5;

// The final number is in the server HTML, so it is correct without JS and for
// screen readers. The first time it scrolls into view the digits count up:
// text is written straight to the node, so React never re-renders per frame.
// Reduced motion keeps the final number as is.
const CountUp = ({ to, suffix = "" }: CountUpProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (reduceMotion || !node) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / DURATION_MS, 1);
          node.textContent = `${Math.round(to * easeOut(progress))}${suffix}`;
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [reduceMotion, to, suffix]);

  return (
    <span ref={ref}>
      {to}
      {suffix}
    </span>
  );
};

export default CountUp;
