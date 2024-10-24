"use client";
import VIP_ICON from "@/components/icons/VIP";
import Particles from "@/components/magicui/particles";
import { BackgroundBeamsWithCollision } from "@/components/ui/background-beams-with-collision";
import { Site, SiteMetadata } from "@/config/site";
import { righteous } from "@/lib/fonts";
import { Button } from "@nextui-org/react";
import { ArrowUpRight } from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RubberBandElement } from "@/components/animations/shoelace/rubber-band";
import Explore from "@/components/sections/Explore";
import EVISIONIT_ICON from "@/components/icons/EvisionIT";

export default function Home() {
  const { theme } = useTheme();
  const [color, setColor] = useState("#ffffff");

  useEffect(() => {
    setColor(theme === "dark" ? "#ffffff" : "#000000");
  }, [theme]);

  return (
    <div>
      {/* HERO */}
      <section
        id="hero"
        className="w-full min-h-[832px] pb-[60px] relative 
        pt-[160px] md:pt-24 sm:pt-32
        dark:from-black dark:to-[#0d0d0d] bg-gradient-to-b 
        flex flex-col items-center"
      >
        <Particles
          className="absolute inset-0"
          quantity={100}
          ease={80}
          color={color}
          refresh
        />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "spring", duration: 2, delay: 0.1 }}
          className="text-[2rem] font-bold"
        >
          Hello, I&apos;m {Site.author}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "spring", duration: 2, delay: 0.2 }}
          className="text-center opacity-65 pt-[12px] flex flex-col items-center"
        >
          <motion.div>
            A Passionate Full-Stack{" "}
            <span className="font-semibold">Software Engineer</span>
          </motion.div>
          <motion.div>
            and <span className="font-semibold">Entrepreneur</span>.
          </motion.div>
        </motion.div>

        {/* HERO BENTO */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", duration: 1 }}
          id="bento"
          className="w-full h-auto flex flex-col justify-center items-center pt-[80px] md:pt-[60px]"
        >
          <div className="flex gap-[32px] justify-center items-center">
            <div className="flex gap-[28px] p-2 sm:flex-col md:flex-col">
              {/* ROW 1 */}
              <div className="flex flex-col justify-center items-center gap-[28px] order-1 sm:order-2 md:order-2">
                {/* CARD 1 = ABOUT */}
                <motion.div
                  initial={{ rotate: 10, x: 400 }}
                  animate={{ rotate: 0, x: 0 }}
                  transition={{ type: "spring", duration: 1.5, delay: 0.5 }}
                >
                  <BackgroundBeamsWithCollision>
                    <div className="w-[288px] min-h-[288px] rounded-[24px] border bg-[#f7f7f7] dark:bg-[#00000052] px-[40px] py-[50px]">
                      <div className="text-center font-bold text-[2rem]">
                        <span className="text-secondaryT">About</span>{" "}
                        <span className="text-[#19cf31] dark:text-[#91FF00]">
                          Me
                        </span>
                      </div>
                      <div className="text-center font-medium text-secondaryT pt-[40px]">
                        I create innovative solutions that transform{" "}
                        <strong>ideas</strong> into <strong>reality</strong>.
                      </div>
                    </div>
                  </BackgroundBeamsWithCollision>
                </motion.div>
              </div>

              {/* ROW 2 */}
              <div className="flex flex-col items-center gap-[28px] order-2 sm:order-1 md:order-1">
                {/* CARD 1 = ME */}
                <RubberBandElement>
                  <div className="w-[406px] h-[362px] rounded-[24px] border relative flex flex-col items-center">
                    <div className="w-full h-full absolute rounded-[24px] from-[#f0f0f0] to-white dark:from-[#1B1C1D] dark:to-[#000000] bg-gradient-to-b opacity-65"></div>

                    <Image
                      src={"/me/sahan.svg"}
                      fill
                      alt={Site.author}
                      className=""
                      priority
                      quality={80}
                    />

                    <div className="px-[16px] py-[6px] rounded-[10px] border  absolute bottom-[40px] bg-[#ffffff68] dark:bg-[#00000068] backdrop-blur-sm">
                      <div className="text-[14px] font-medium opacity-65">
                        {SiteMetadata.legalName}
                      </div>
                    </div>
                  </div>
                </RubberBandElement>

                {/* CARD 2 = MY COMPANY */}
                <motion.div
                  initial={{ y: -260 }}
                  animate={{ y: 0 }}
                  transition={{ type: "spring", duration: 1.5, delay: 0.5 }}
                  className="w-[288px] min-h-[220px] pt-[30px] pb-[20px] rounded-[24px] border bg-[#f7f7f7] dark:bg-[#00000052] flex flex-col items-center justify-center box-border px-[25px]"
                >
                  <div className="w-[80px] h-[80px] rounded-full bg-black dark:bg-white flex justify-center items-center pt-[3px]">
                    <EVISIONIT_ICON
                      className="fill-white dark:fill-black"
                      width={60}
                      height={30}
                    />
                  </div>
                  <div className="text-[10px] font-medium opacity-65 pt-[14px]">
                    Founder & CEO of Evision IT
                  </div>

                  <Link
                    href={Site.orgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button className="mt-[20px] justify-start text-center h-[40px] w-full border rounded-full p-[4px] flex items-center gap-[10px] bg-[#ffffff75] dark:bg-[#00000075] backdrop-blur-sm">
                      <div className="p-[8px] flex justify-center items-center border bg-[#f7f7f756] dark:bg-[#23232356] backdrop-blur-sm rounded-full w-fit h-fit">
                        <VIP_ICON className="fill-[#FFB84D]" />
                      </div>
                      <span
                        className={`${righteous.className} text-[14px] bg-evisionBro text-center w-full bg-clip-text text-transparent`}
                      >
                        www.evisionit.lk
                      </span>
                    </Button>
                  </Link>
                </motion.div>
              </div>

              {/* ROW 3 */}
              <div className="flex flex-col justify-center items-center gap-[28px] cursor-pointer order-3">
                {/* CARD 3 = CONTACT ME */}
                <motion.div
                  initial={{ rotate: -10, x: -400 }}
                  animate={{ rotate: 0, x: 0 }}
                  transition={{ type: "spring", duration: 1.5, delay: 0.5 }}
                  className="h-[200px]"
                >
                  <Link href={"/contact"}>
                    <Button className="w-[288px] h-full rounded-[24px] border relative group bg-transparent">
                      <div className="z-10 w-full h-full absolute rounded-[24px] from-[#ffdfd4] dark:from-[#3C231A] dark:to-[#060606] bg-gradient-to-b opacity-50"></div>

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

                {/* CARD 4 = RANDOM SERVICE OR SKILL */}
                {/* <div className="h-[200px] w-[288px] border rounded-[24px]"></div> */}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* WHAT I DO */}

      <Explore />
    </div>
  );
}
