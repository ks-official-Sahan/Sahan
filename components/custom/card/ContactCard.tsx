"use client";

import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Site } from "@/config/site";
import { cn } from "@/lib/utils";

interface ContactCardProps {
  className?: string;
  width?: number;
  height?: number;
  initial?: Record<string, any>;
  inView?: Record<string, any>;
  transition?: Record<string, any>;
}

const ContactCard: React.FC<ContactCardProps> = ({
  className = "flex",
  width = 288,
  height = 200,
  initial = { opacity: -3, y: 150 },
  inView = { opacity: 1, y: 0 },
  transition = { type: "spring", duration: 1.5, delay: 0.35 },
}) => {
  return (
    <motion.div
      initial={initial}
      whileInView={inView}
      transition={transition}
      className={cn("relative flex items-center justify-center", className)}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      <Link
        href="/contact"
        className="group relative w-full h-full rounded-[28px] overflow-hidden border border-[#1b3d26]/60 dark:border-[#225032]/50 block shadow-lg transition-transform duration-200 active:scale-[0.98]"
        style={{
          background:
            "radial-gradient(135% 115% at 20% 10%, #0d2919 0%, #071a10 50%, #030a06 100%)",
        }}
      >
        {/* Subtle inner top-edge ambient highlight */}
        <div className="absolute inset-0 rounded-[28px] pointer-events-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]" />

        {/* Title: Contact Me */}
        <div className="absolute top-[22px] left-[24px] z-20 flex items-center font-semibold text-[24px] tracking-tight select-none">
          <span className="text-[#d4d4d8]">Contact</span>
          <span className="text-[#FF8C00] ml-[6px]">Me</span>
        </div>

        {/* Little Tiger Illustration */}
        <div className="absolute bottom-[2px] left-[14px] z-20 pointer-events-none select-none">
          <Image
            src="/av/little-tiger.svg"
            width={112}
            height={112}
            alt={Site.author}
            priority
            className="object-contain drop-shadow-md"
          />
        </div>

        {/* Circular Arrow Button */}
        <div className="absolute bottom-[22px] right-[24px] z-20 w-[48px] h-[48px] rounded-full border-2 border-white flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:bg-white/10">
          <ArrowUpRight
            size={26}
            className="text-white stroke-white stroke-[2.2] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </div>
      </Link>
    </motion.div>
  );
};

export default ContactCard;
