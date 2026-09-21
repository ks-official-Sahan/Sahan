import { cn } from "@/lib/utils";
import React from "react";

interface SnapRowProps {
  /** Accessible name for the scrollable region. */
  label: string;
  /** Grid classes used from tablet up, e.g. "s768:grid-cols-2". */
  gridClassName: string;
  children: React.ReactNode;
}

// Phones get a swipeable snap carousel (a native gesture, no JS, next card
// peeking as the scroll hint). From 768px it becomes a plain grid, so the same
// content reads as a different layout per device instead of one long stack.
// `reveal` sits on the scroller itself: a view timeline inside a horizontal
// scroller would track the wrong axis.
const SnapRow = ({ label, gridClassName, children }: SnapRowProps) => (
  <div
    role="region"
    aria-label={label}
    // Scrollable regions must be reachable by keyboard.
    tabIndex={0}
    className={cn(
      "reveal no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-3 [scroll-padding-inline:1rem]",
      "s640:-mx-8 s640:px-8 s640:[scroll-padding-inline:2rem]",
      "s768:mx-0 s768:grid s768:snap-none s768:overflow-visible s768:px-0 s768:pb-0",
      gridClassName
    )}
  >
    {React.Children.map(children, (child) => (
      <div className="w-[82%] max-w-[380px] shrink-0 snap-start s768:w-auto s768:max-w-none s768:shrink">
        {child}
      </div>
    ))}
  </div>
);

export default SnapRow;
