"use client";
import Particles from "@/components/magicui/particles";
import { Site } from "@/config/site";
import { useTheme } from "next-themes";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Explore from "@/components/sections/Explore";
import UserCard from "@/components/custom/card/UserCard";
import CompanyCard from "@/components/custom/card/CompanyCard";
import ContactCard from "@/components/custom/card/ContactCard";
import AboutCard from "@/components/custom/card/AboutCard";

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
          initial={{ y: 500, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", duration: 3 }}
          id="bento"
          className="w-full h-auto flex flex-col justify-center items-center pt-[80px] md:pt-[60px]"
        >
          <div className="flex gap-[32px] justify-center items-center">
            <div className="flex gap-[28px] p-2 sm:flex-col md:flex-col">
              {/* ROW 1 */}
              <div className="flex flex-col justify-center items-center gap-[28px] order-1 sm:order-2 md:order-2">
                {/* CARD 1 = ABOUT */}
                <AboutCard />
              </div>

              {/* ROW 2 */}
              <div className="flex flex-col items-center gap-[28px] order-2 sm:order-1 md:order-1">
                {/* CARD 1 = ME */}
                <UserCard className="flex sm:hidden" />
                <UserCard className="hidden sm:flex" width={300} height={320} />

                {/* CARD 2 = MY COMPANY */}
                <CompanyCard />
              </div>

              {/* ROW 3 */}
              <div className="flex flex-col justify-center items-center gap-[28px] cursor-pointer order-3">
                {/* CARD 3 = CONTACT ME */}
                <ContactCard />

                {/* CARD 4 = RANDOM SERVICE OR SKILL */}
                {/* <ServiceCard /> */}
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
