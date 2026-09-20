"use client";

import Descriptor from "@/components/home/Descriptor";
import WrapperBody from "@/components/wrappers/WrapperBody";
import { HomeContent } from "@/contents/home";
import Link from "next/link";
import React, { useState } from "react";

const FAQSection = () => {
  const { faq } = HomeContent;
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <section id="faq" className="flex flex-col items-center pt-[100px]">
      <WrapperBody>
        {/* TITLE */}
        <div className="flex items-end gap-5">
          <div>
            <div className="flex w-fit items-center gap-[6px] rounded-full border bg-bCHIP py-[6px] pl-[10px] pr-5">
              <span aria-hidden="true">{faq.icon}</span>
              <span className="pt-px text-[14px] font-medium opacity-60">
                {faq.label}
              </span>
            </div>

            <h2 className="pt-5 font-bold uppercase leading-[102%]">
              <span className="block text-[20px]">{faq.title[0]}</span>
              <span className="block text-[40px] text-bICON">
                {faq.title[1]}
              </span>
              <span className="block text-[40px]">{faq.title[2]}</span>
            </h2>
          </div>

          <div className="flex-1 pb-[10px] sm:hidden">
            <div className="h-px w-full bg-bBORDERFADE" />
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex w-full gap-[10px] pt-10 md:flex-col sm:flex-col">
          <div className="flex w-7/12 flex-col gap-[10px] md:w-full sm:w-full">
            {faq.questions.map((item) => (
              <Descriptor
                key={item.id}
                item={item}
                isOpen={openId === item.id}
                onToggle={() => setOpenId(openId === item.id ? null : item.id)}
              />
            ))}
          </div>

          <aside className="flex h-fit flex-1 flex-col gap-3 rounded-[12px] border border-bBORDERFADE bg-bCARD p-6 lg:sticky lg:top-28">
            <div aria-hidden="true" className="text-[28px]">
              💬
            </div>
            <h3 className="text-[18px] font-semibold">Still have questions?</h3>
            <p className="text-[14px] opacity-70">
              Can&apos;t find what you&apos;re looking for? Send me a message
              and we can talk it through.
            </p>
            <Link
              href="/contact"
              className="mt-2 w-fit rounded-[12px] border border-bBORDERFADE bg-bICON_FADE px-6 py-2 text-[14px] font-semibold text-bICON transition-opacity hover:opacity-80"
            >
              Contact me
            </Link>
          </aside>
        </div>
      </WrapperBody>
    </section>
  );
};

export default FAQSection;
