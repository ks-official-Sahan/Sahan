"use client"
import React from "react";
import dynamic from "next/dynamic";

// Define the types for the SlAnimation props
interface SlAnimationProps {
  name: string;
  duration: number;
  iterations: number;
  delay: number;
  play: boolean;
  children?: React.ReactNode;
}

const SlAnimation = dynamic<SlAnimationProps>(() => import('@shoelace-style/shoelace/dist/react/animation'), {
  loading: () => <div>Loading...</div>,
  ssr: false,
});

interface RubberBandElementProps {
  children: React.ReactNode;
}

export const JelloElement = ({ children }: RubberBandElementProps) => {
  return (
    <div>
      <SlAnimation name="jello" duration={2000} iterations={1} delay={1000} play>
        {children}
      </SlAnimation>
    </div>
  );
};
