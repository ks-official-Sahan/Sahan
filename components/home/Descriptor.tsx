"use client";

import { cn } from "@/lib/utils";
import type { FAQItem } from "@/types/faq";
import { Minus, Plus } from "lucide-react";
import React from "react";

interface DescriptorProps {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}

const Descriptor = ({ item, isOpen, onToggle }: DescriptorProps) => {
  const { id, icon, question, answer } = item;

  return (
    <div className="w-full rounded-[12px] border border-bBORDERFADE bg-bCARD">
      <h3>
        <button
          type="button"
          id={`faq-trigger-${id}`}
          aria-expanded={isOpen}
          aria-controls={`faq-panel-${id}`}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 p-5 text-left"
        >
          <span className="flex items-center gap-[14px]">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-bBORDER_SHADE"
            >
              {icon}
            </span>
            <span className="font-medium">{question}</span>
          </span>

          <span
            aria-hidden="true"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-bCHIP opacity-70"
          >
            {isOpen ? <Minus size={20} /> : <Plus size={20} />}
          </span>
        </button>
      </h3>

      {/* `hidden` must sit on an element without a display utility, otherwise
          the utility wins over the [hidden] rule and the panel never hides. */}
      <div
        id={`faq-panel-${id}`}
        role="region"
        aria-labelledby={`faq-trigger-${id}`}
        hidden={!isOpen}
      >
        <div
          className={cn(
            "flex flex-col gap-3 px-5 pb-5 text-[14px] leading-relaxed opacity-85",
            "animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none"
          )}
        >
          <p>{answer.intro}</p>

          {answer.points && (
            <ul className="list-disc space-y-1.5 pl-5 marker:text-bICON">
              {answer.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          )}

          {answer.outro && <p>{answer.outro}</p>}
        </div>
      </div>
    </div>
  );
};

export default Descriptor;
