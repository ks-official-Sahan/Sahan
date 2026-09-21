"use client";

import { useReducedMotion } from "framer-motion";
import React, { useEffect, useRef } from "react";

const FRAMES = 8;
const frame = (n: number) => `/gm/s1/run-${n}.png`;

// The old runner re-rendered React eight times a second forever. This one
// swaps the sprite on the DOM node directly, only while it is on screen, and
// stands still for anyone who asked for reduced motion. The travel itself is
// a CSS transform (see `runner-travel` in globals.css).
const RunnerTrack = () => {
  const img = useRef<HTMLImageElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = img.current;
    if (!node || reduceMotion) return;

    // Warm the cache so the first lap does not flicker.
    for (let n = 1; n <= FRAMES; n++) new window.Image().src = frame(n);

    let current = 1;
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        current = current === FRAMES ? 1 : current + 1;
        node.src = frame(current);
      }, 70);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    const observer = new IntersectionObserver(([entry]) =>
      entry.isIntersecting ? start() : stop()
    );
    observer.observe(node);

    return () => {
      stop();
      observer.disconnect();
    };
  }, [reduceMotion]);

  return (
    <div
      aria-hidden="true"
      className="runner-travel absolute bottom-3 left-0 z-0 motion-reduce:animate-none motion-reduce:[transform:translateX(1.5rem)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src={frame(1)}
        alt=""
        width={72}
        height={72}
        className="h-[clamp(52px,7vw,72px)] w-auto select-none"
        draggable={false}
      />
    </div>
  );
};

export default RunnerTrack;
