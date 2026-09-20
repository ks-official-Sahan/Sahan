import { Site } from "@/config/site";
import { Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import React from "react";

const actionClass =
  "flex h-[46px] w-full items-center justify-center gap-[6px] rounded-[12px] bg-bFRAME text-[14px] font-medium transition-opacity hover:opacity-80";

// Content-only: the parent wraps this in its own card so it matches the
// surrounding bento cells.
const AvailableCard = () => {
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex w-fit items-center gap-[10px] rounded-full border border-bBORDER_SHADE bg-bCHIP py-[6px] pl-[10px] pr-5">
        <span className="relative flex h-[13px] w-[13px]">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bICON opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-[13px] w-[13px] rounded-full bg-bICON" />
        </span>
        <span className="text-[14px] font-semibold opacity-70">
          Available for remote work
        </span>
      </div>

      <div className="flex w-full flex-col gap-[10px]">
        <a href={`mailto:${Site.email}`} className={actionClass}>
          <Mail size={14} className="text-bICON" aria-hidden="true" />
          <span className="opacity-80">Email me</span>
        </a>
        <Link href="/contact" className={actionClass}>
          <MessageCircle size={14} className="text-bICON" aria-hidden="true" />
          <span className="opacity-80">Send a message</span>
        </Link>
      </div>
    </div>
  );
};

export default AvailableCard;
