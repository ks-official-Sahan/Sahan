"use client";

import type { PageContent } from "@/lib/cms/registry";
import { RefreshCw } from "lucide-react";
import React, { useState } from "react";

// A small toy with a real job: it lists what Sahan actually does, one phrase
// at a time. It never rotates by itself (no surprise motion, no lost place for
// screen-reader users); a tap or Enter swaps the word. Keyed so the swap
// animation replays, and announced politely.

interface RandomIamProps {
  content: PageContent<"home">["iam"];
}

const RandomIam = ({ content: iam }: RandomIamProps) => {
  const [index, setIndex] = useState(0);

  const next = () => setIndex((current) => (current + 1) % iam.words.length);

  return (
    <button
      type="button"
      onClick={next}
      className="press group flex h-full min-h-[132px] w-full flex-col justify-between gap-4 rounded-[16px] border border-bBORDERFADE bg-bCARD p-5 text-left"
    >
      <span className="text-sm opacity-70">{iam.prefix}</span>
      <span
        aria-live="polite"
        className="block text-[length:clamp(1.25rem,2vw,1.6rem)] font-semibold leading-tight text-bICON"
      >
        <span key={index} className="swap-in block">
          {iam.words[index]}
        </span>
      </span>
      <span className="flex items-center gap-2 text-xs opacity-70">
        <RefreshCw
          size={14}
          aria-hidden="true"
          className="transition-transform duration-300 [transition-timing-function:var(--ease-out)] group-active:rotate-180"
        />
        {iam.hint}
      </span>
    </button>
  );
};

export default RandomIam;
