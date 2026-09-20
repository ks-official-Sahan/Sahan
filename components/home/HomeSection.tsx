import WrapperBody from "@/components/wrappers/WrapperBody";
import { cn } from "@/lib/utils";
import React from "react";

interface HomeSectionProps {
  id: string;
  /** id of the section's h2, used as the region's accessible name. */
  labelledBy?: string;
  /** Fallback accessible name for sections without a visible heading. */
  label?: string;
  className?: string;
  children: React.ReactNode;
}

// One place for the vertical rhythm of every home section, so whitespace stays
// consistent: fluid, from 64px on phones to 112px on large screens.
const HomeSection = ({
  id,
  labelledBy,
  label,
  className,
  children,
}: HomeSectionProps) => (
  <section
    id={id}
    aria-labelledby={labelledBy}
    aria-label={labelledBy ? undefined : label}
    className={cn(
      "flex flex-col items-center pt-[clamp(4rem,8vw,7rem)]",
      className
    )}
  >
    <WrapperBody>{children}</WrapperBody>
  </section>
);

/** Index for the CSS scroll-reveal stagger (see `.reveal` in globals.css). */
export const stagger = (index: number) =>
  ({ "--i": index }) as React.CSSProperties;

export default HomeSection;
