import React from "react";
import { motion } from "framer-motion";
import { BackgroundBeamsWithCollision } from "@/components/ui/background-beams-with-collision";

const AboutCard = () => {
  return (
    <motion.div
      initial={{ rotate: 10, x: 400 }}
      animate={{ rotate: 0, x: 0 }}
      transition={{ type: "spring", duration: 1.5, delay: 0.5 }}
    >
      <BackgroundBeamsWithCollision>
        <div className="w-[288px] min-h-[288px] rounded-[24px] border bg-[#f7f7f7] dark:bg-[#00000052] px-[40px] py-[50px]">
          <div className="text-center font-bold text-[2rem]">
            <span className="text-secondaryT">About</span>{" "}
            <span className="text-[#19cf31] dark:text-[#91FF00]">Me</span>
          </div>
          <div className="text-center font-medium text-secondaryT pt-[40px]">
            I create innovative solutions that transform <strong>ideas</strong>{" "}
            into <strong>reality</strong>.
          </div>
        </div>
      </BackgroundBeamsWithCollision>
    </motion.div>
  );
};

export default AboutCard;
