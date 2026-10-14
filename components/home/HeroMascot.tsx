"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

// A head that watches the cursor (page-mascot, https://koboyo.com/page-mascot).
// Two 3x3 sprite sheets: nine head directions and nine expressions. Turning is
// a background-position swap, so there is no animation library and no
// per-frame work; state changes only when the pointer crosses into another
// eighth of the circle. Touch screens get the resting face, reduced motion
// skips the squash, and the sheets are 576px webp (about 50 KB each).

const DIRECTIONS = ["up-left", "up", "up-right", "left", "center", "right", "down-left", "down", "down-right"] as const;
const REACTIONS = ["blink", "heart", "sparkle", "surprised", "wink", "bashful", "sleepy", "dizzy", "delighted"] as const;

type Direction = (typeof DIRECTIONS)[number];
type Reaction = (typeof REACTIONS)[number];

// Clockwise from the right, matching atan2 with y pointing down.
const CLOCKWISE: Direction[] = ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"];
const SECTOR = (Math.PI * 2) / CLOCKWISE.length;
const HYSTERESIS = 0.12;
const DEAD_ZONE = 70;

const PAYOFFS: Reaction[] = ["heart", "sparkle", "delighted"];
const BOOP_PAYOFF = 120;
const BOOP_END = 560;
const SQUASH_MS = 420;
const DIZZY_AFTER = 4;
const DIZZY_WINDOW = 1600;
const DIZZY_END = 1100;

const SQUASH: Keyframe[] = [
  { transform: "scale(1, 1)", easing: "ease-in" },
  { transform: "scale(1.10, 0.86)", offset: 0.18, easing: "ease-out" },
  { transform: "scale(0.95, 1.08)", offset: 0.45, easing: "ease-in-out" },
  { transform: "scale(1.03, 0.97)", offset: 0.72, easing: "ease-in-out" },
  { transform: "scale(1, 1)" },
];

// background-size 300% makes each cell a clean 0/50/100% step on both axes.
const cell = (index: number): CSSProperties => ({
  backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`,
});

const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

const LAYER = "absolute inset-0 bg-no-repeat [background-size:300%_300%]";

export interface HeroMascotProps {
  /** Served path of the 3x3 head-directions sheet. */
  directions: string;
  /** Served path of the 3x3 expressions sheet. */
  reactions: string;
  /** What a screen reader calls it. */
  label: string;
  /** Size utilities; the box is square. */
  className?: string;
}

export default function HeroMascot({ directions, reactions, label, className }: HeroMascotProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const squashRef = useRef<HTMLSpanElement>(null);
  const timersRef = useRef<number[]>([]);
  const boopsRef = useRef({ count: 0, at: 0 });
  const [direction, setDirection] = useState<Direction>("center");
  const [reaction, setReaction] = useState<Reaction | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let sector = -1;
    let pointer: { x: number; y: number } | null = null;

    const aim = () => {
      const button = buttonRef.current;
      if (!button || !pointer) return;
      const box = button.getBoundingClientRect();
      const dx = pointer.x - (box.left + box.width / 2);
      const dy = pointer.y - (box.top + box.height / 2);

      if (Math.hypot(dx, dy) < DEAD_ZONE) {
        sector = -1;
        setDirection("center");
        return;
      }
      // Hold the current sector until the pointer is well past its edge.
      const angle = Math.atan2(dy, dx);
      if (sector !== -1 && Math.abs(wrap(angle - sector * SECTOR)) < SECTOR / 2 + HYSTERESIS) return;
      sector = (Math.round(angle / SECTOR) + CLOCKWISE.length) % CLOCKWISE.length;
      setDirection(CLOCKWISE[sector]);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      aim();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", aim, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", aim);
    };
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(window.clearTimeout);
  }, []);

  const boop = () => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current.length = 0;
    const later = (ms: number, next: Reaction | null) => {
      timersRef.current.push(window.setTimeout(() => setReaction(next), ms));
    };

    const now = Date.now();
    const boops = boopsRef.current;
    boops.count = now - boops.at < DIZZY_WINDOW ? boops.count + 1 : 1;
    boops.at = now;

    if (boops.count >= DIZZY_AFTER) {
      boops.count = 0;
      setReaction("dizzy");
      later(DIZZY_END, null);
    } else {
      setReaction("blink");
      later(BOOP_PAYOFF, PAYOFFS[(boops.count - 1) % PAYOFFS.length]);
      later(BOOP_END, null);
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Per-keyframe easing with a linear effect: an effect-level easing would
    // reinterpret every offset and front-load the whole bounce.
    squashRef.current?.animate(SQUASH, { duration: SQUASH_MS, easing: "linear" });
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={boop}
      aria-label={`Boop the ${label}`}
      className={cn(
        "relative block shrink-0 cursor-pointer select-none rounded-2xl outline-offset-4 [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-bICON",
        className
      )}
    >
      <span ref={squashRef} className="relative block size-full [transform-origin:50%_78%]">
        <span
          aria-hidden="true"
          className={LAYER}
          style={{ backgroundImage: `url(${directions})`, ...cell(DIRECTIONS.indexOf(direction)), opacity: reaction ? 0 : 1 }}
        />
        {/* Always mounted, so the sheet is fetched up front and never on the first click. */}
        <span
          aria-hidden="true"
          className={LAYER}
          style={{ backgroundImage: `url(${reactions})`, ...cell(REACTIONS.indexOf(reaction ?? "blink")), opacity: reaction ? 1 : 0 }}
        />
      </span>
    </button>
  );
}
