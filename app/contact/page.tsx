"use client";
import IconInput from "@/components/common/IconInput";
import ContactDetailsBox from "@/components/contact/ContactDetailsBox";
import ContactDetailsCard from "@/components/contact/ContactDetailsCard";
import { RainbowButton } from "@/components/magicui/rainbow-button";
import WrapperBody from "@/components/wrappers/WrapperBody";
import { TopicInputOptions } from "@/contents/contact";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import {
  Mail,
  MapPin,
  MessageCircle,
  PhoneIcon,
  Shapes,
  User,
} from "lucide-react";
import React from "react";
import X_ICON from "@/components/icons/twitter-X";
import LINKEDIN_ICON from "@/components/icons/Linkedin";
import { motion } from "framer-motion";
import { Button } from "@nextui-org/react";
import Link from "next/link";

const Contact = () => {
  return (
    <div className="w-full min-h-screen ">
      <section className="w-full from-[#f7f7f7] to-white dark:from-[#11111112] dark:to-[#00000012] pt-[171px] pb-20 min-h-[720px] border-b  bg-gradient-to-b ct-box">
        <WrapperBody>
          <div className="w-full flex sm:flex-col md:flex-col items-center justify-between gap-[80px]">
            {/* LEFT */}
            <div className="flex flex-col justify-center items-center">
              <div className="text-[40px] font-bold">Let’s Collaborate!</div>
              <div className="flex flex-col text-secondaryT pt-3">
                <div>Got a question or a project in mind? </div>
                <div>Chat with my AI or leave me a message!</div>
              </div>

              <div className="pt-[68px]">
                <ContactDetailsBox>
                  <ContactDetailsCard
                    copy
                    icon={<Mail size={24} />}
                    title="Email"
                    value="ks.official.sahan@gmail.com"
                  />
                  <ContactDetailsCard
                    copy
                    icon={<PhoneIcon size={24} />}
                    title="Phone Number"
                    value="+94768701148"
                    displayValue="+94 76-870-1148"
                  />
                  <ContactDetailsCard
                    icon={<MapPin size={24} />}
                    title="Location"
                    value="Sri Lanka - Available for Remote Work"
                  />
                </ContactDetailsBox>
              </div>
            </div>

            {/* RIGHT */}
            <div className="w-full max-w-[556px] flex flex-col gap-[48px] px-5 justify-center items-center">
              <div className="flex sm:flex-col items-center gap-[20px] w-full">
                <IconInput
                  icon={<User size={16} />}
                  placeholder="Your First Name"
                />
                <IconInput
                  icon={<User size={16} />}
                  placeholder="Your Last Name"
                />
              </div>
              <div className="flex sm:flex-col items-center gap-[20px] w-full">
                <IconInput
                  inputType="email"
                  icon={<Mail size={16} />}
                  placeholder="example@domain.com"
                />
                <IconInput
                  type="select"
                  icon={<Shapes size={16} />}
                  placeholder="Select Your Topic"
                  options={TopicInputOptions}
                  optionTitle="Topic"
                />
              </div>
              <div className="flex w-full flex-col gap-[30px]">
                <IconInput
                  type="textarea"
                  icon={<MessageCircle size={16} />}
                  className="min-h-[160px]"
                  placeholder="Your Message"
                />
                <RainbowButton>Send Message</RainbowButton>
              </div>
            </div>
          </div>
        </WrapperBody>
      </section>

      {/* SOCIAL MEDIA */}
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
    </div>
  );
};

export default Contact;
