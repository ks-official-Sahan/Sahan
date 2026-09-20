"use client";

import { animate, useInView, useReducedMotion } from "framer-motion";
import React, { useEffect, useRef } from "react";

interface CountUpProps {
  to: number;
  suffix?: string;
}

// The final number is in the server HTML, so it is correct without JS and for
// screen readers. Once it scrolls into view the digits count up on the
// compositor-friendly path: text is written straight to the node, so React
// never re-renders per frame. Reduced motion keeps the final number as is.
const CountUp = ({ to, suffix = "" }: CountUpProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!inView || reduceMotion || !node) return;

    const controls = animate(0, to, {
      duration: 1.1,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (value) => {
        node.textContent = `${Math.round(value)}${suffix}`;
      },
    });

    return () => controls.stop();
  }, [inView, reduceMotion, to, suffix]);

  return (
    <span ref={ref}>
      {to}
      {suffix}
    </span>
  );
};

export default CountUp;
