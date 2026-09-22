"use client";

import Descriptor from "@/components/home/Descriptor";
import HomeSection from "@/components/home/HomeSection";
import SectionHeading from "@/components/home/SectionHeading";
import type { PageContent } from "@/lib/cms/registry";
import Link from "next/link";
import React, { useState } from "react";

interface FAQSectionProps {
  content: PageContent<"home">["faq"];
  labels: PageContent<"home">["home"];
}

const FAQSection = ({ content: faq, labels: home }: FAQSectionProps) => {
  const { questions } = faq;
  const [openId, setOpenId] = useState<number | null>(null); // index or null

  return (
    <HomeSection id="faq" labelledBy="faq-title">
      <SectionHeading
        id="faq-title"
        title={home.faq.title}
        description={home.faq.subtitle}
      />

      <div className="mt-10 flex w-full flex-col gap-3 lg:flex-row lg:gap-5">
        <div className="flex flex-col gap-3 lg:w-7/12">
          {questions.map((item, index) => (
            <Descriptor
              key={index}
              item={item}
              index={index}
              isOpen={openId === index}
              onToggle={() => setOpenId(openId === index ? null : index)}
            />
          ))}
        </div>

        <aside className="flex h-fit flex-1 flex-col gap-3 rounded-[12px] border border-bBORDERFADE bg-bCARD p-6 lg:sticky lg:top-28">
          <h3 className="text-lg font-semibold">Still have questions?</h3>
          <p className="text-[15px] leading-relaxed opacity-70">
            Send me a message and we can talk it through.
          </p>
          <Link
            href="/contact"
            className="press mt-2 inline-flex min-h-11 w-fit items-center rounded-full border border-bBORDERFADE bg-bICON_FADE px-6 text-sm font-semibold text-bICON"
          >
            Contact me
          </Link>
        </aside>
      </div>
    </HomeSection>
  );
};

export default FAQSection;
