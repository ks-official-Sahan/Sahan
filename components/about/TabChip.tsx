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
          "rounded-[10px] border px-4 py-[6px] text-[14px] font-medium transition-colors",
          selected
            ? "bg-bICON_FADE text-bICON"
            : "bg-bCHIP opacity-70 hover:opacity-100"
        )}
      >
        {title}
      </button>
    );
  }
);

TabChip.displayName = "TabChip";

export default TabChip;
