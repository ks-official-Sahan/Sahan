import React from "react";
import { motion } from "framer-motion";
import { Button } from "@nextui-org/react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Site } from "@/config/site";


const ContactCard = () => {
  return (
    <motion.div
      initial={{ rotate: -10, x: -400 }}
      animate={{ rotate: 0, x: 0 }}
      transition={{ type: "spring", duration: 1.5, delay: 0.5 }}
      className="h-[200px]"
    >
      <Link href={"/contact"}>
        <Button className="w-[288px] h-full rounded-[24px] border relative group bg-transparent">
          <div className="z-10 w-full h-full absolute rounded-[24px] from-[#2cac5b6b] dark:from-[#1a914677] dark:to-[#060606] bg-gradient-to-b opacity-50"></div>

          <Image
            src={"/av/little-tiger.svg"}
            width={121}
            height={121}
            alt={Site.author}
            className="z-20 absolute bottom-[-5px] left-[12px]"
          />

          <div className="z-50 absolute top-[26px] left-[26px] font-semibold text-[1.5rem]">
            <span className="text-secondaryT">Contact</span>{" "}
            <span className="text-[#FF8C00]">Me</span>
          </div>

          <div className="z-50 absolute w-[46px] h-[46px] rounded-full border-2  bottom-[24px] right-[24px] flex justify-center items-center group-hover:border-black dark:group-hover:border-white">
            <ArrowUpRight
              size={31}
              className="opacity-45 group-hover:opacity-100"
            />
          </div>
        </Button>
      </Link>
    </motion.div>
  );
};

export default ContactCard;