"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AnimatedSvg from "./AnimatedSvg";
import { Howl } from "howler";

const LoadingScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const entrySound = new Howl({
      src: ["/aud/entry.mp3"],
    });

    const handleComplete = () => {
      entrySound.play();
      setTimeout(() => {
        setLoading(false);
      }, 1000); // Ensures loader stays for at least 1 second
    };

    // Set loading state to true on route change start
    router.prefetch("/"); // Example prefetch, use router.push or similar if needed
    setLoading(true);

    // Call handleComplete on route change complete
    handleComplete();

    // Cleanup on unmount
    return () => {
      // Clean up any side effects if necessary
    };
  }, [router]);

  return (
    <div
      className={`fixed inset-0 bg-black flex justify-center items-center z-[9999] transition-all duration-[2000ms] pb-[40px] ${
        loading ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`relative flex flex-col items-center transition-transform duration-[1000ms] ${
          loading ? "scale-100" : "scale-50"
        }`}
      >
        <AnimatedSvg />
        {/* <div className="absolute bottom-[-30px] h-2 w-10 bg-gray-500 rounded-full animate-bounce"></div> */}
      </div>
      {!loading && (
        <div className="fixed inset-0 flex justify-center items-center">
          <div className="w-full h-full bg-black absolute transition-transform duration-[1000ms] transform origin-left"></div>
          <div className="w-full h-full bg-black absolute transition-transform duration-[1000ms] transform origin-right"></div>
        </div>
      )}
    </div>
  );
};

export default LoadingScreen;
