import WrapperBody from "@/components/wrappers/WrapperBody";
import { CommonData } from "@/contents/common";
import { cn } from "@/lib/utils";
import Link from "next/link";
import React from "react";

const CTACard = ({ className }: { className?: string }) => {
  const { title, subtitle, action, href } = CommonData.cta;

  return (
    <div className={cn("mt-[80px] w-full", className)}>
      <WrapperBody>
        <div className="flex min-h-[280px] w-full flex-col justify-center rounded-[12px] border border-bBORDERFADE bg-bCARD p-[60px] sm:p-8">
          <h2 className="text-[2rem] font-semibold leading-[40px]">{title}</h2>
          <p className="max-w-[520px] pt-3 text-[13px] font-medium opacity-70">
            {subtitle}
          </p>

          <Link
            href={href}
            className="mt-6 w-fit rounded-[12px] border border-bBORDERFADE bg-bICON_FADE px-7 py-2 text-[14px] font-semibold text-bICON transition-opacity hover:opacity-80"
          >
            {action}
          </Link>
        </div>
      </WrapperBody>
    </div>
  );
};

export default CTACard;
