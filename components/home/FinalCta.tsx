"use client";

import HomeSection from "@/components/home/HomeSection";
import { Site } from "@/config/site";
import { HomeContent } from "@/contents/home";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

const FinalCta = () => {
  const { finalCta } = HomeContent;
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    []
  );

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(Site.email);
    } catch {
      // Clipboard can be blocked; the address is visible below, so the user
      // can still select it by hand.
      return;
    }
    setCopied(true);
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <HomeSection
      id="contact-cta"
      labelledBy="cta-title"
      className="pb-[clamp(4rem,8vw,7rem)]"
    >
      <div className="reveal flex flex-col items-start gap-8 rounded-[16px] border border-bBORDERFADE bg-bCARD p-[clamp(1.5rem,5vw,3.5rem)]">
        <div className="max-w-[56ch]">
          <h2
            id="cta-title"
            className="text-balance text-[length:clamp(1.75rem,3.4vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.02em]"
          >
            {finalCta.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed opacity-70">
            {finalCta.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={finalCta.primary.href}
            className="press arrow-nudge inline-flex min-h-12 items-center gap-2 rounded-full bg-bCHIPSELECTED px-7 text-[15px] font-semibold text-white dark:text-black"
          >
            {finalCta.primary.label}
            <ArrowUpRight
              size={18}
              aria-hidden="true"
              className="arrow-nudge-icon"
            />
          </Link>

          <button
            type="button"
            onClick={copyEmail}
            className="press inline-flex min-h-12 items-center gap-2 rounded-full border border-bBORDERFADE bg-bFCARD px-6 text-[15px] font-semibold"
          >
            {copied ? (
              <Check size={18} aria-hidden="true" />
            ) : (
              <Copy size={18} aria-hidden="true" />
            )}
            {copied ? finalCta.copiedLabel : finalCta.copyLabel}
          </button>
          <span role="status" className="sr-only">
            {copied ? finalCta.copiedLabel : ""}
          </span>
        </div>

        <p className="text-sm opacity-70">
          Or write to{" "}
          <a
            href={`mailto:${Site.email}`}
            className="font-medium underline underline-offset-4"
          >
            {Site.email}
          </a>
        </p>
      </div>
    </HomeSection>
  );
};

export default FinalCta;
