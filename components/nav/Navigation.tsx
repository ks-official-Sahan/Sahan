"use client";

import React, { useEffect, useState } from "react";
import WrapperBody from "../wrappers/WrapperBody";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useDisclosure } from "@mantine/hooks";
import { Site } from "@/config/site";
import SideBar from "./SideBar";
import NavBar from "./Nav";

const Navigation = () => {
  const [currentPath, setCurrentPath] = useState("");
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const path = usePathname();

  const [opened, { toggle, close }] = useDisclosure();

  useEffect(() => {
    if (path === "/") {
      setCurrentPath("home");
    } else if (path.endsWith("about")) {
      setCurrentPath("about");
    } else if (path.endsWith("works")) {
      setCurrentPath("works");
    } else if (path.endsWith("updates")) {
      setCurrentPath("updates");
    } else if (path.endsWith("blog")) {
      setCurrentPath("blog");
    } else if (path.endsWith("contact")) {
      setCurrentPath("contact");
    }
  }, [path]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY;

      if (currentScroll > scrollPosition) {
        // Scrolling down
        setIsVisible(false);
      } else {
        // Scrolling up
        setIsVisible(true);
      }

      setScrollPosition(currentScroll);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [scrollPosition]);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: isVisible ? 0 : -100 }}
      exit={{ y: -100 }}
      transition={{ duration: 0.4, type: "spring" }}
      className="w-full fixed top-0 pt-[30px] z-[100]"
    >
      {/* Drawer --> SideBar */}
      <SideBar
        title={Site.siteName}
        opened={opened}
        close={close}
        currentPath={currentPath}
      />

      <WrapperBody>
        <NavBar
          title={Site.siteName}
          currentPath={currentPath}
          opened={opened}
          toggle={toggle}
        />
      </WrapperBody>
    </motion.header>
  );
};

export default Navigation;
