"use client";

import React, { useCallback, useEffect, useState } from "react";
import WrapperBody from "../wrappers/WrapperBody";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Site } from "@/config/site";
import SideBar from "./SideBar";
import NavBar from "./Nav";

const Navigation = () => {
  const [currentPath, setCurrentPath] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const path = usePathname();

  const [opened, setOpened] = useState(false);
  const toggle = useCallback(() => setOpened((value) => !value), []);
  const close = useCallback(() => setOpened(false), []);

  const prefersReducedMotion = useReducedMotion();

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
    <>
      {/* Drawer --> SideBar. Rendered as a sibling of motion.header, not a
          child: framer-motion animates the header via a CSS `transform`, and
          a transformed ancestor becomes the containing block for any
          `position: fixed` descendant (CSS spec), which silently broke this
          drawer's viewport-relative sizing when it was nested inside — its
          width/height resolved against the header's own box instead of the
          viewport. Mantine's original Drawer never hit this because it
          portals to document.body; this sidesteps the same problem by simply
          not being a descendant of the transformed element. */}
      <SideBar
        title={Site.siteName}
        opened={opened}
        close={close}
        currentPath={currentPath}
      />

      <motion.header
        // initial={false}: skip the mount-only slide-in entirely under
        // prefers-reduced-motion instead of playing it once then disabling
        // later animations — reducedMotion is resolved synchronously (framer-
        // motion reads matchMedia during render), so this is correct on the
        // very first paint, not just after an effect catches up.
        initial={prefersReducedMotion ? false : { y: -100 }}
        animate={{ y: isVisible ? 0 : -100 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, type: "spring" }}
        className="w-full fixed top-0 pt-[30px] z-[100]"
      >
        <WrapperBody>
          <NavBar
            title={Site.siteName}
            currentPath={currentPath}
            opened={opened}
            toggle={toggle}
          />
        </WrapperBody>
      </motion.header>
    </>
  );
};

export default Navigation;
