import React from "react";
import { motion } from "framer-motion";
import { Site } from "@/config/site";


const Header = () => {
  return (
    <>
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
    </>
  );
};

export default Header;
