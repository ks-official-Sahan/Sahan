"use client";

import React from "react";
import { motion } from "framer-motion";
import { Button } from "@nextui-org/react";
import Link from "next/link";
import WrapperBody from "@/components/wrappers/WrapperBody";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import LINKEDIN_ICON from "@/components/icons/Linkedin";
import X_ICON from "@/components/icons/twitter-X";


const SocialMedia = () => {
  return (
    <motion.section
      initial={{ y: 0, opacity: 0 }}
      animate={{ y: -40, opacity: 1 }}
      transition={{ type: "spring", duration: 0.5, delay: 1 }}
      className="w-full"
    >
      <WrapperBody>
        <div className="w-full min-h-[270px] rounded-[24px] py-5 px-[60px] box-border flex sm:flex-col justify-between items-center border from-white to-[#f7f7f7] dark:from-[#000000] dark:to-[#0F0F0F] bg-gradient-to-r">
          <div>
            <div className="text-[36px] font-bold">
              Reach Me on Social Media
            </div>
            <div className="pt-3 text-secondaryT">
              Get know about me with my social media profiles
            </div>
          </div>
          <div className="flex items-center gap-[14px] mt-5 mb-3">
            <div className="flex flex-col sm:flex-row gap-[14px]">
              <Link
                href={"https://github.com/ks-official-Sahan"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-[80px] h-[80px] border  rounded-[16px] bg-[#fafafa] dark:bg-[#00000035] backdrop-blur-sm flex items-center justify-center">
                  <GitHubLogoIcon width={33} height={33} />
                </Button>
              </Link>
              <Link
                href={"https://www.linkedin.com/in/sahan-sachintha"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-[80px] h-[80px] border  rounded-[16px] bg-[#006adc] dark:bg-[#00409A35] backdrop-blur-sm flex items-center justify-center">
                  <LINKEDIN_ICON className="fill-white" />
                </Button>
              </Link>
            </div>
            <Link
              href={"https://x.com/SahanSubasingha"}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="w-[80px] h-[80px] border rounded-[16px] bg-[#fafafa] dark:bg-[#00000035] backdrop-blur-sm flex items-center justify-center">
                <X_ICON className="fill-black dark:fill-white" />
              </Button>
            </Link>
          </div>
        </div>
      </WrapperBody>
    </motion.section>
  );
};

export default SocialMedia;
