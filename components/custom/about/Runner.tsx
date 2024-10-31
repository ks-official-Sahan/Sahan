"use client";

import Image from "next/image";
import React, { useLayoutEffect, useState } from "react";

const Runner = () => {
  const [sprite, setSprite] = useState(1);

  const run = () => {
    setSprite((prev) => (prev === 8 ? 1 : prev + 1));
  };

  useLayoutEffect(() => {
    const intervalId = setInterval(run, 56);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <>
      <Image
        src={`/gm/s1/run-${sprite}.png`}
        alt="Sprite"
        width={80}
        height={80}
        className="object-cover"
      />
    </>
  );
};

export default Runner;
