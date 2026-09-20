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

  const lastScrollY = React.useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      setIsVisible(currentScroll <= lastScrollY.current || currentScroll < 10);
      lastScrollY.current = currentScroll;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []); // stable — registered once

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
