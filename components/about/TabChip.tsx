import { cn } from "@/lib/utils";
import React from "react";

interface TabChipProps {
  title: string;
  selected?: boolean;
  onClick?: () => void;
  /** Wire up the tab to its panel for assistive tech. */
  id?: string;
  controls?: string;
}

// Tabs never move on their own (a moving target is a bad click target); when
// there are too many for the width, the tab row scrolls sideways instead.
const TabChip = React.memo(
  ({ title, selected = false, onClick, id, controls }: TabChipProps) => {
    return (
      <button
        type="button"
        role="tab"
        id={id}
        aria-selected={selected}
        aria-controls={controls}
        onClick={onClick}
        className={cn(
          "press min-h-11 shrink-0 snap-start whitespace-nowrap rounded-full border px-5 text-[14px] font-medium transition-colors",
          selected
            ? "border-transparent bg-bICON_FADE text-bICON"
            : "border-bBORDERFADE bg-bCHIP opacity-80 hover:opacity-100"
        )}
      >
        {title}
      </button>
    );
  }
);

TabChip.displayName = "TabChip";

export default TabChip;
