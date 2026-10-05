"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// Section navigation for the settings screen. One list, two layouts: a sticky
// row of chips under the top bar on small screens, a sticky column beside the
// sections from lg up. The highlighted entry follows the scroll position
// (IntersectionObserver, no scroll listener), clicking jumps with the native
// anchor (sections carry scroll-margin for the sticky bars) and updates the
// URL hash, so a section can be linked to directly.

export interface SettingsNavItem {
  id: string;
  label: string;
}

export default function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const visible = useRef(new Map<string, boolean>());
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.current.set(entry.target.id, entry.isIntersecting);
        // The first section, in page order, inside the band below the sticky bars.
        const current = items.find((item) => visible.current.get(item.id));
        if (current) setActive(current.id);
      },
      { rootMargin: "-120px 0px -55% 0px" }
    );
    // The observer's first callback reports every section's state, so a page
    // opened at #section highlights it once the browser has scrolled there.
    for (const item of items) {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [items]);

  // Keep the active chip in view on the horizontal (small screen) row.
  useEffect(() => {
    const link = listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(active)}"]`);
    if (link && listRef.current && listRef.current.scrollWidth > listRef.current.clientWidth) {
      link.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [active]);

  if (items.length < 2) return null;

  return (
    <nav
      aria-label="Settings sections"
      className="sticky top-14 z-20 -mx-4 mb-6 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:top-20 lg:mx-0 lg:mb-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
    >
      <p className="mb-2 hidden text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:block">On this page</p>
      <ul ref={listRef} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:gap-0.5 lg:overflow-visible">
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                data-id={item.id}
                aria-current={current ? "location" : undefined}
                onClick={() => setActive(item.id)}
                className={cn(
                  "block whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:rounded-md lg:border-0 lg:border-l-2 lg:px-3 lg:py-1.5 lg:text-sm",
                  current
                    ? "border-primary bg-primary text-primary-foreground lg:border-primary lg:bg-muted lg:text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground lg:border-transparent lg:hover:bg-muted/60"
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
