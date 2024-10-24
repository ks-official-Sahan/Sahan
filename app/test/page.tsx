"use client";

import { useRef, useEffect } from "react";
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/dist/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const Works = () => {
  const scrollSectionRef = useRef<HTMLDivElement | null>(null);
  const horizontalScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollSectionRef.current && horizontalScrollRef.current) {
      const horizontalScrollWidth = horizontalScrollRef.current.scrollWidth;

      const scrollAnimation = gsap.to(horizontalScrollRef.current, {
        x: () =>
          -(
            horizontalScrollWidth -
            (scrollSectionRef.current
              ? scrollSectionRef.current.offsetWidth
              : 0)
          ),
        ease: "none",
        scrollTrigger: {
          trigger: scrollSectionRef.current,
          start: "top top",
          end: () => `+=${horizontalScrollWidth}`, // End after horizontal scroll is complete
          pin: true, // Pin the section while scrolling horizontally
          scrub: 1, // Smooth scrolling
          invalidateOnRefresh: true, // Ensure it recalculates on resize
        },
      });

      return () => {
        scrollAnimation.kill(); // Clean up the animation on unmount
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill()); // Clean up all triggers
      };
    }
  }, []); // Empty dependency array to run on mount and unmount

  return (
    <div className="relative min-h-screen">
      {/* Other sections before horizontal scroll */}
      <div className="min-h-screen bg-green-500 flex items-center justify-center">
        <h1 className="text-4xl text-white">
          Scroll Down to Horizontal Scroll
        </h1>
      </div>

      {/* Horizontal Scroll Section */}
      <div ref={scrollSectionRef} className="relative h-screen overflow-hidden">
        <div
          ref={horizontalScrollRef}
          className="absolute top-0 left-0 flex "
          style={{ height: "100%", width: "300%" }} // Make it wider for horizontal scroll
        >
          {/* Add your work cards or content here */}
          <div className="w-screen h-full bg-lime-500 flex justify-center items-center text-black">
            <h2 className="text-3xl">Work 1</h2>
          </div>
          <div className="w-screen h-full bg-blue-500 flex justify-center items-center text-white">
            <h2 className="text-3xl">Work 2</h2>
          </div>
          <div className="w-screen h-full bg-purple-500 flex justify-center items-center text-white">
            <h2 className="text-3xl">Work 3</h2>
          </div>
        </div>
      </div>

      {/* Other sections after horizontal scroll */}
      <div className="min-h-screen bg-gray-800 flex items-center justify-center">
        <h1 className="text-4xl text-white">More content below</h1>
      </div>
    </div>
  );
};

export default Works;
