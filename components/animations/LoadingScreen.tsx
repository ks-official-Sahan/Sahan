"use client";

import React, { useEffect, useState } from "react";
import AnimatedSvg from "./AnimatedSvg";

const LoadingScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Dismiss loading overlay after 1 second — no door sound.
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`fixed inset-0 bg-black flex justify-center items-center z-[9999] transition-opacity duration-[1500ms] pb-[40px] ${
        loading ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`relative flex flex-col items-center transition-transform duration-[1000ms] ${
          loading ? "scale-100" : "scale-50"
        }`}
      >
        <AnimatedSvg />
      </div>
    </div>
  );
};

export default LoadingScreen;
